// ─────────────────────────────────────────────────────────
// modules/orbEngine.js — Opening Range Breakout Strategy
//
// Logic:
//  1. Market opens 9:15 AM IST
//  2. First 5-min candle = 9:15–9:20 AM
//  3. ORB High = High of that candle
//  4. ORB Low  = Low  of that candle
//  5. BUY  when any subsequent candle CLOSES above ORB High
//  6. SELL when any subsequent candle CLOSES below ORB Low
//  7. SL trailed to entry when 50% of target achieved
//  8. Reverse signal on SL/Target hit
// ─────────────────────────────────────────────────────────
const EventEmitter = require('events');
const logger       = require('./logger');

class ORBEngine extends EventEmitter {
  constructor() {
    super();

    // Per-symbol state maps
    this.candles1M  = {};   // symbol → Candle[]   (1-min OHLCV)
    this.candles5M  = {};   // symbol → Candle[]   (5-min OHLCV)
    this.orbLevels  = {};   // symbol → { high, low, locked, lockedAt }
    this.orbTracking= {};   // symbol → { high, low } — tracks 9:15-9:20 range live
    this.signals    = {};   // symbol → { direction, entry, sl, target, qty, trailed, id }

    // Runtime flags
    this.enabled         = false;   // master on/off
    this.stockToggles    = {};      // symbol → bool
    this.rrConfig        = {
      capital:    parseFloat(process.env.DEFAULT_CAPITAL   || 50000),
      leverage:   parseInt  (process.env.DEFAULT_LEVERAGE  || 5),
      riskPct:    parseFloat(process.env.DEFAULT_RISK_PCT  || 2),
      rrRatio:    parseFloat(process.env.DEFAULT_RR_RATIO  || 2),
      maxSLPerDay: parseInt (process.env.MAX_SL_PER_DAY    || 3)
    };
    this.slHitsToday  = {};   // symbol → count
    this.tgtHitsToday = {};   // symbol → count
    this.dailyPnl     = {};   // symbol → ₹ P&L

    // ORB window: 9:15 to 9:20
    this.ORB_START_H = 9; this.ORB_START_M = 15;
    this.ORB_END_H   = 9; this.ORB_END_M   = 20;
  }

  // ── Called on every tick from FyersDataFeed ───────────────
  onTick(symbol, tick) {
    this._buildCandle('1M', symbol, tick, 1);
    this._buildCandle('5M', symbol, tick, 5);
    this._trackORBRange(symbol, tick);
  }

  // ── Track ORB range live from 9:15 to 9:20 ───────────────
  _trackORBRange(symbol, tick) {
    if (this.orbLevels[symbol]?.locked) return;
    const now = new Date();
    const h = now.getHours(), m = now.getMinutes();
    // Only track between 9:15 and 9:20
    const afterOpen  = (h > 9) || (h === 9 && m >= 15);
    const beforeLock = (h < 9) || (h === 9 && m < 20);
    if (!afterOpen || !beforeLock) return;

    if (!this.orbTracking[symbol]) {
      this.orbTracking[symbol] = { high: tick.ltp, low: tick.ltp };
    } else {
      this.orbTracking[symbol].high = Math.max(this.orbTracking[symbol].high, tick.ltp);
      this.orbTracking[symbol].low  = Math.min(this.orbTracking[symbol].low,  tick.ltp);
    }
  }

  // ── Candle builder ────────────────────────────────────────
  _buildCandle(tf, symbol, tick, intervalMins) {
    const store = tf === '1M' ? this.candles1M : this.candles5M;
    if (!store[symbol]) store[symbol] = [];

    const now        = new Date();
    const minuteOfDay = now.getHours() * 60 + now.getMinutes();
    const candleKey  = Math.floor(minuteOfDay / intervalMins); // bucket index

    const list = store[symbol];

    if (list.length === 0 || list[list.length - 1].key !== candleKey) {
      // ── Close previous candle ──────────────────────────
      if (list.length > 0) {
        const prev = list[list.length - 1];
        prev.closed = true;
        if (tf === '5M') this._onCandle5MClose(symbol, prev);
      }

      // ── Open new candle ────────────────────────────────
      list.push({
        key:    candleKey,
        time:   new Date(now.getFullYear(), now.getMonth(), now.getDate(),
                         now.getHours(), Math.floor(minuteOfDay / intervalMins) * intervalMins),
        open:   tick.ltp,
        high:   tick.ltp,
        low:    tick.ltp,
        close:  tick.ltp,
        volume: tick.ltq || 0,
        closed: false
      });
    } else {
      // ── Update current candle ──────────────────────────
      const c = list[list.length - 1];
      c.high   = Math.max(c.high, tick.ltp);
      c.low    = Math.min(c.low,  tick.ltp);
      c.close  = tick.ltp;
      c.volume += (tick.ltq || 0);

      // ── Check SL/Target on every tick (intra-candle) ──
      if (tf === '5M' && this.signals[symbol]) {
        this._checkSLTarget(symbol, tick.ltp, c);
      }
    }

    // Keep only last 200 candles
    if (list.length > 200) list.shift();
  }

  // ── Called on each 5-min candle close ────────────────────
  _onCandle5MClose(symbol, candle) {
    const now = new Date();
    const h = now.getHours(), m = now.getMinutes();

    // ── 1. Lock ORB at 9:20 AM ONLY from live ticks ─────────
    // If already locked from history (setORBFromHistory), skip
    if (!this.orbLevels[symbol]?.locked) {
      const tracked = this.orbTracking[symbol];
      // Only lock at exactly 9:20-9:21 AM AND only if we have tracked data
      const isLockTime = h === this.ORB_END_H && (m === this.ORB_END_M || m === this.ORB_END_M + 1);
      if (isLockTime && tracked) {
        this.orbLevels[symbol] = {
          high: tracked.high, low: tracked.low,
          locked: true, lockedAt: new Date(), source: 'live'
        };
        logger.info(`[ORB] ${symbol} LOCKED from live ticks. H=${tracked.high} L=${tracked.low}`);
        this.emit('orbLocked', { symbol, high: tracked.high, low: tracked.low, candle });
        return;
      }
      // Past 9:21 but no lock — don't lock with current candle data
      // setORBFromHistory() will handle this via REST call
      return;
    }

    const orb = this.orbLevels[symbol];
    if (!orb?.locked) return;

    // ── 2. Stop if 15:30 ──────────────────────────────────
    if (h >= 15 && m >= 25) return;

    // ── 3. Skip if stock toggled off or master off ────────
    if (!this.enabled) return;
    if (this.stockToggles[symbol] === false) return;

    // ── 4. Skip if existing open signal ───────────────────
    if (this.signals[symbol]) return;

    // ── 5. Risk check — daily SL limit ────────────────────
    const slToday = this.slHitsToday[symbol] || 0;
    if (slToday >= this.rrConfig.maxSLPerDay) {
      logger.warn(`[ORB] ${symbol} — Max SL hits (${slToday}) reached for today. Skipping.`);
      return;
    }

    // ── 6. ORB Breakout detection on CANDLE CLOSE ─────────
    // BUY:  close > ORB High AND low < ORB High (candle crossed through)
    // SELL: close < ORB Low  AND high > ORB Low (candle crossed through)
    let direction = null;
    if (candle.close > orb.high && candle.low < orb.high)  direction = 'BUY';
    if (candle.close < orb.low  && candle.high > orb.low)  direction = 'SELL';
    if (!direction) return;

    logger.info(`[ORB] Breakout check: close=${candle.close} high=${candle.high} low=${candle.low} orbHigh=${orb.high} orbLow=${orb.low} → ${direction}`);

    // ── 7. Calculate entry / SL / Target / Qty ────────────
    const entry    = candle.close;
    const { capital, leverage, riskPct, rrRatio } = this.rrConfig;
    const effectiveCap = capital * leverage;
    const riskAmount   = (effectiveCap * riskPct) / 100;

    // SL = ORB opposite side, Target = entry ± (slPoints * rrRatio)
    let sl, target, slPoints;
    if (direction === 'BUY') {
      sl       = orb.low;
      slPoints = entry - sl;
      target   = entry + slPoints * rrRatio;
    } else {
      sl       = orb.high;
      slPoints = sl - entry;
      target   = entry - slPoints * rrRatio;
    }

    const qty = Math.max(1, Math.floor(riskAmount / slPoints));
    const signalId = `${symbol}_${direction}_${Date.now()}`;

    const signal = {
      id: signalId,
      symbol,
      direction,
      entry:       +entry.toFixed(2),
      sl:          +sl.toFixed(2),
      target:      +target.toFixed(2),
      qty,
      slPoints:    +slPoints.toFixed(2),
      trailed:     false,
      openedAt:    new Date().toISOString(),
      candleTime:  candle.time
    };

    logger.info(
      `[ORB] 🚀 SIGNAL → ${direction} ${symbol} | Entry:${entry.toFixed(2)} SL:${sl.toFixed(2)} Tgt:${target.toFixed(2)} Qty:${qty}`
    );

    this.emit('signal', signal);
  }

  // ── Register an open signal (after order placed) ──────────
  registerSignal(signal) {
    this.signals[signal.symbol] = { ...signal };
  }

  // ── Clear a signal (after exit) ───────────────────────────
  clearSignal(symbol) {
    delete this.signals[symbol];
  }

  // ── Check SL/Target on tick ───────────────────────────────
  _checkSLTarget(symbol, ltp, currentCandle) {
    const sig = this.signals[symbol];
    if (!sig) return;
    const { direction, entry, sl, target } = sig;

    if (direction === 'BUY') {
      // Trail SL → entry when 50% target achieved
      if (!sig.trailed && ltp >= entry + (target - entry) * 0.5) {
        sig.sl      = entry;
        sig.trailed = true;
        logger.info(`[ORB] 📌 ${symbol} SL trailed to entry (${entry}) at 50% target`);
        this.emit('slTrailed', { symbol, newSl: entry, ltp });
      }
      // SL hit (candle low touches SL)
      if (currentCandle.low <= sig.sl) {
        this._onExit(symbol, 'SL_HIT', sig.sl, direction);
      }
      // Target hit (candle high touches target)
      if (currentCandle.high >= target) {
        this._onExit(symbol, 'TARGET_HIT', target, direction);
      }
    }

    if (direction === 'SELL') {
      if (!sig.trailed && ltp <= entry - (entry - target) * 0.5) {
        sig.sl      = entry;
        sig.trailed = true;
        logger.info(`[ORB] 📌 ${symbol} SL trailed to entry (${entry}) at 50% target`);
        this.emit('slTrailed', { symbol, newSl: entry, ltp });
      }
      if (currentCandle.high >= sig.sl) {
        this._onExit(symbol, 'SL_HIT', sig.sl, direction);
      }
      if (currentCandle.low <= target) {
        this._onExit(symbol, 'TARGET_HIT', target, direction);
      }
    }
  }

  // ── Handle exit ───────────────────────────────────────────
  _onExit(symbol, reason, exitPrice, direction) {
    const sig = this.signals[symbol];
    if (!sig) return;

    const pnl = direction === 'BUY'
      ? (exitPrice - sig.entry) * sig.qty
      : (sig.entry - exitPrice) * sig.qty;

    if (reason === 'SL_HIT') {
      this.slHitsToday[symbol] = (this.slHitsToday[symbol] || 0) + 1;
    } else {
      this.tgtHitsToday[symbol] = (this.tgtHitsToday[symbol] || 0) + 1;
    }
    this.dailyPnl[symbol] = (this.dailyPnl[symbol] || 0) + pnl;

    logger.info(`[ORB] 🏁 ${reason} ${symbol} | Exit:${exitPrice} PnL:${pnl.toFixed(2)}`);

    this.emit('exit', {
      symbol, reason, exitPrice, direction,
      entry:   sig.entry,
      qty:     sig.qty,
      pnl:     +pnl.toFixed(2),
      signal:  sig
    });

    this.clearSignal(symbol);
  }

  // ── Get candles for chart ─────────────────────────────────
  getCandles(symbol, tf = '5M') {
    const store = tf === '1M' ? this.candles1M : this.candles5M;
    return (store[symbol] || []).slice(-100);
  }

  // ── Set ORB from historical candles (fetched from Fyers) ──
  setORBFromHistory(symbol, candles) {
    if (!candles?.length) return;

    const today = new Date();
    const todayStr = today.toDateString();

    // Find today's candles
    const todayCandles = candles.filter(c => {
      const d = new Date(c.time);
      return d.toDateString() === todayStr;
    });

    if (!todayCandles.length) {
      logger.warn(`[ORB] No today candles for ${symbol}`);
      return;
    }

    // First candle of today = 9:15 AM ORB candle
    const firstCandle = todayCandles[0];
    const orbHigh = firstCandle.high;
    const orbLow  = firstCandle.low;

    if (!this.orbLevels[symbol]?.locked) {
      this.orbLevels[symbol] = {
        high:     orbHigh,
        low:      orbLow,
        locked:   true,
        lockedAt: new Date(),
        source:   'historical'
      };
      logger.info(`[ORB] ${symbol} ORB set from history: H=${orbHigh} L=${orbLow}`);
      this.emit('orbLocked', { symbol, high: orbHigh, low: orbLow });
    }
  }

  // ── Get ORB level for symbol ──────────────────────────────
  getORBLevel(symbol) {
    return this.orbLevels[symbol] || null;
  }

  // ── Get all active signals ────────────────────────────────
  getActiveSignals() {
    return { ...this.signals };
  }

  // ── Get stats ─────────────────────────────────────────────
  getStats() {
    return {
      slHitsToday:  this.slHitsToday,
      tgtHitsToday: this.tgtHitsToday,
      dailyPnl:     this.dailyPnl,
      orbLevels:    this.orbLevels,
      activeSignals: Object.keys(this.signals).length
    };
  }

  // ── Daily reset at 9:00 AM ────────────────────────────────
  dailyReset() {
    this.candles1M    = {};
    this.candles5M    = {};
    this.orbLevels    = {};
    this.orbTracking  = {};
    this.signals      = {};
    this.slHitsToday  = {};
    this.tgtHitsToday = {};
    this.dailyPnl     = {};
    logger.info('[ORB] 🔄 Daily reset complete');
    this.emit('dailyReset');
  }

  // ── Update config from frontend ───────────────────────────
  updateConfig(config) {
    this.rrConfig = { ...this.rrConfig, ...config };
    logger.info('[ORB] Config updated:', JSON.stringify(this.rrConfig));
  }

  // ── Set master trading enable ─────────────────────────────
  setEnabled(val) {
    this.enabled = val;
    logger.info(`[ORB] Master trading: ${val ? 'ENABLED' : 'DISABLED'}`);
  }

  // ── Set individual stock toggle ───────────────────────────
  setStockToggle(symbol, val) {
    this.stockToggles[symbol] = val;
  }
}

module.exports = new ORBEngine();

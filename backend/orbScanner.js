// ═══════════════════════════════════════════════════════════════
// orbScanner.js — Server-side ORB Engine (runs 24/7)
// Scans all selected stocks for ORB breakout signals
// Executes orders automatically via Fyers/Delta
// ═══════════════════════════════════════════════════════════════

const axios = require('axios');

class ORBScanner {
  constructor(config = {}) {
    this.rrConfig = config.rrConfig || {};
    this.orderExecutor = config.orderExecutor || null;
    this.fyersAuth = config.fyersAuth || null;
    this.logger = config.logger || console;
    this.emit = config.emit || (() => {});

    // ORB state per symbol
    this.orbLevels = {};    // {symbol: {high, low, date}}
    this.activeTrades = {}; // {symbol: {type, entry, sl, tgt, time}}
    this.dailySignals = {}; // {symbol: {buyFired, sellFired, date}}
    this.tradeLog = [];     // all executed trades

    this.scanInterval = null;
    this.isRunning = false;
    this.selectedSymbols = [];
    this.masterEnabled = false;
  }

  // ── Start scanning ──────────────────────────────────────────
  start(symbols, masterEnabled) {
    this.selectedSymbols = symbols;
    this.masterEnabled = masterEnabled;
    if (this.scanInterval) clearInterval(this.scanInterval);

    this.logger.info('[ORB] Scanner started for ' + symbols.length + ' stocks');
    this.emit('orbStatus', { running: true, symbols: symbols.length });

    // Scan every 5 seconds
    this.scanInterval = setInterval(() => {
      if (!this.masterEnabled) return;
      this._scanAll();
    }, 5000);

    // Initial scan
    this._scanAll();
    this.isRunning = true;
  }

  stop() {
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
    this.isRunning = false;
    this.logger.info('[ORB] Scanner stopped');
    this.emit('orbStatus', { running: false });
  }

  updateConfig(rrConfig) {
    this.rrConfig = { ...this.rrConfig, ...rrConfig };
  }

  updateSymbols(symbols) {
    this.selectedSymbols = symbols;
  }

  setMaster(enabled) {
    this.masterEnabled = enabled;
    if (!enabled) this.logger.info('[ORB] Master OFF — signals blocked');
  }

  // ── Core scan loop ──────────────────────────────────────────
  async _scanAll() {
    const now = new Date();
    const istH = (now.getUTCHours() + 5) % 24 + (now.getUTCMinutes() + 30 >= 60 ? 1 : 0);
    const istM = (now.getUTCMinutes() + 30) % 60;
    const istTime = istH * 100 + istM;

    // Only scan during market hours (9:15 — 15:30 IST)
    if (istTime < 915 || istTime > 1530) return;

    const today = now.toDateString();

    // Reset daily state at market open
    if (istTime >= 915 && istTime <= 920) {
      Object.keys(this.dailySignals).forEach(sym => {
        if (this.dailySignals[sym].date !== today) {
          this.dailySignals[sym] = { buyFired: false, sellFired: false, date: today };
          delete this.orbLevels[sym]; // force recalculate
          delete this.activeTrades[sym];
        }
      });
    }

    for (const sym of this.selectedSymbols) {
      try {
        await this._scanSymbol(sym, today, istTime);
      } catch (e) {
        // Silent fail per symbol — don't crash scanner
      }
    }
  }

  async _scanSymbol(sym, today, istTime) {
    // Initialize daily state
    if (!this.dailySignals[sym] || this.dailySignals[sym].date !== today) {
      this.dailySignals[sym] = { buyFired: false, sellFired: false, date: today };
    }

    // Fetch latest candle from Yahoo via server-side (no CORS)
    const yahooSym = sym.replace('NSE:', '').replace('-EQ', '.NS');
    let candles;
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSym)}?interval=5m&range=1d&includePrePost=false`;
      const resp = await axios.get(url, { timeout: 8000, headers: { 'User-Agent': 'Mozilla/5.0' } });
      const result = resp.data?.chart?.result?.[0];
      if (!result) return;
      const ts = result.timestamp || [];
      const q = result.indicators?.quote?.[0] || {};
      candles = ts.map((t, i) => ({
        time: t, open: q.open?.[i], high: q.high?.[i], low: q.low?.[i],
        close: q.close?.[i], volume: q.volume?.[i] || 0
      })).filter(c => c.open && c.close && !isNaN(c.close));
    } catch (e) {
      return; // Yahoo failed — skip this tick
    }

    if (!candles || !candles.length) return;

    // ── Step 1: Find ORB levels (first 5min candle of today) ──
    if (!this.orbLevels[sym] || this.orbLevels[sym].date !== today) {
      for (const c of candles) {
        const d = new Date(c.time * 1000);
        const cIstH = (d.getUTCHours() + 5) % 24 + (d.getUTCMinutes() + 30 >= 60 ? 1 : 0);
        const cIstM = (d.getUTCMinutes() + 30) % 60;
        if (cIstH === 9 && cIstM >= 15 && cIstM <= 20) {
          this.orbLevels[sym] = { high: c.high, low: c.low, date: today };
          this.logger.info(`[ORB] ${sym} Levels → H:${c.high} L:${c.low}`);
          this.emit('orbLevels', { symbol: sym, high: c.high, low: c.low });
          break;
        }
      }
    }

    const orb = this.orbLevels[sym];
    if (!orb) return; // no ORB levels yet

    // ── Step 2: Check active trade SL/TGT ──────────────────────
    const latest = candles[candles.length - 1];
    if (this.activeTrades[sym]) {
      const t = this.activeTrades[sym];
      let exitType = null, exitPrice = null;

      if (t.type === 'buy') {
        if (latest.low <= t.sl) { exitType = 'buy_sl'; exitPrice = t.sl; }
        else if (latest.high >= t.tgt) { exitType = 'buy_tgt'; exitPrice = t.tgt; }
      } else {
        if (latest.high >= t.sl) { exitType = 'sell_sl'; exitPrice = t.sl; }
        else if (latest.low <= t.tgt) { exitType = 'sell_tgt'; exitPrice = t.tgt; }
      }

      if (exitType) {
        this.logger.info(`[ORB] ${sym} EXIT: ${exitType} @ ${exitPrice}`);
        await this._placeOrder(sym, exitType, exitPrice, t);
        delete this.activeTrades[sym];
        this.emit('orbTrade', { symbol: sym, type: exitType, price: exitPrice, action: 'exit' });
      }
      return; // active trade — block new signals
    }

    // ── Step 3: Check for ORB breakout ─────────────────────────
    // Only check after 9:25 IST (give first candle time to form)
    if (istTime < 925) return;

    const c = latest;
    const isBuy  = (c.close > orb.high) && (c.low <= orb.high);
    const isSell = (c.close < orb.low)  && (c.high >= orb.low);

    if (isBuy && !this.dailySignals[sym].buyFired) {
      this.dailySignals[sym].buyFired = true;
      const trade = this._buildTrade(sym, 'buy', c.close);
      this.activeTrades[sym] = trade;
      this.logger.info(`[ORB] ✅ ${sym} BUY @ ${c.close} | SL:${trade.sl} TGT:${trade.tgt} QTY:${trade.qty}`);
      await this._placeOrder(sym, 'buy', c.close, trade);
      this.emit('orbTrade', { symbol: sym, type: 'buy', price: c.close, ...trade, action: 'entry' });
    }

    if (isSell && !this.dailySignals[sym].sellFired) {
      this.dailySignals[sym].sellFired = true;
      const trade = this._buildTrade(sym, 'sell', c.close);
      this.activeTrades[sym] = trade;
      this.logger.info(`[ORB] ✅ ${sym} SELL @ ${c.close} | SL:${trade.sl} TGT:${trade.tgt} QTY:${trade.qty}`);
      await this._placeOrder(sym, 'sell', c.close, trade);
      this.emit('orbTrade', { symbol: sym, type: 'sell', price: c.close, ...trade, action: 'entry' });
    }
  }

  // ── Build trade with RR ─────────────────────────────────────
  _buildTrade(sym, type, price) {
    const rp = this.rrConfig.riskPct || 1;
    const rr = this.rrConfig.rrRatio || 2;
    const cap = this.rrConfig.capital || 50000;
    const lev = this.rrConfig.leverage || 4;
    const effCap = cap * lev;
    const riskAmt = effCap * rp / 100;
    const slDist = price * rp / 100;
    const qty = Math.max(1, Math.floor(riskAmt / slDist));
    const sl = type === 'buy' ? price - slDist : price + slDist;
    const tgt = type === 'buy' ? price + slDist * rr : price - slDist * rr;
    return {
      type, entry: price, sl: parseFloat(sl.toFixed(2)),
      tgt: parseFloat(tgt.toFixed(2)), qty,
      riskPct: rp, rrRatio: rr, time: new Date().toISOString()
    };
  }

  // ── Place order via Fyers ───────────────────────────────────
  async _placeOrder(sym, type, price, trade) {
    if (!this.masterEnabled) {
      this.logger.info(`[ORB] Order blocked — Master OFF | ${sym} ${type}`);
      return;
    }

    // Convert to Fyers symbol format
    const fyersSym = sym.replace('.NS', '-EQ').replace('NSE:', '');
    const fyersSymFull = fyersSym.startsWith('NSE:') ? fyersSym : `NSE:${fyersSym}`;
    const side = (type === 'buy' || type === 'sell_sl' || type === 'sell_tgt') ? 'BUY' : 'SELL';

    // Determine order qty
    const qty = trade.qty || 1;

    // Log trade
    this.tradeLog.push({
      symbol: sym, type, side, price, qty,
      sl: trade.sl, tgt: trade.tgt,
      time: new Date().toISOString(),
      status: 'PENDING'
    });

    try {
      if (!this.orderExecutor) {
        this.logger.error('[ORB] No order executor configured');
        return;
      }

      const result = await this.orderExecutor.placeOrder({
        symbol: fyersSymFull,
        side: side === 'BUY' ? 1 : -1,
        qty,
        orderType: 'MARKET',
        productType: process.env.PRODUCT_TYPE || 'INTRADAY'
      });

      const logEntry = this.tradeLog[this.tradeLog.length - 1];
      logEntry.status = result.success ? 'EXECUTED' : 'FAILED';
      logEntry.orderId = result.orderId;
      logEntry.error = result.error;

      if (result.success) {
        this.logger.info(`[ORB] ✅ Order executed: ${side} ${qty} ${fyersSymFull} @ MARKET | ID:${result.orderId}`);
      } else {
        this.logger.error(`[ORB] ❌ Order failed: ${result.error}`);
      }

      this.emit('orbOrder', logEntry);
    } catch (e) {
      this.logger.error(`[ORB] Order error: ${e.message}`);
      const logEntry = this.tradeLog[this.tradeLog.length - 1];
      logEntry.status = 'ERROR';
      logEntry.error = e.message;
    }
  }

  // ── Public getters ──────────────────────────────────────────
  getStatus() {
    return {
      running: this.isRunning,
      master: this.masterEnabled,
      symbols: this.selectedSymbols.length,
      orbLevels: this.orbLevels,
      activeTrades: this.activeTrades,
      dailySignals: this.dailySignals,
      tradeLog: this.tradeLog.slice(-50)
    };
  }

  getLevels() { return this.orbLevels; }
  getActiveTrades() { return this.activeTrades; }
  getTradeLog() { return this.tradeLog; }
}

module.exports = ORBScanner;

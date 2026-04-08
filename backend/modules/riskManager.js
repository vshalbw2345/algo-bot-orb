// ─────────────────────────────────────────────────────────
// modules/riskManager.js — Risk Control & Daily Limits
//
// Rules enforced:
//  1. Max SL hits per stock per day
//  2. Daily P&L loss limit (stops ALL trading)
//  3. Daily profit target (optional lock-in)
//  4. Position size validation
//  5. Market hours enforcement (9:15–15:20 only)
// ─────────────────────────────────────────────────────────
const EventEmitter = require('events');
const logger       = require('./logger');

class RiskManager extends EventEmitter {
  constructor() {
    super();

    // Config (overridable from frontend)
    this.config = {
      capital:         parseFloat(process.env.DEFAULT_CAPITAL  || 50000),
      leverage:        parseInt  (process.env.DEFAULT_LEVERAGE || 5),
      riskPct:         parseFloat(process.env.DEFAULT_RISK_PCT || 2),
      rrRatio:         parseFloat(process.env.DEFAULT_RR_RATIO || 2),
      maxSLPerDay:     parseInt  (process.env.MAX_SL_PER_DAY   || 3),
      dailyLossCapPct: 6,          // % of capital — hard stop all trading
      trailingPct:     50,         // % of target at which SL trails to entry
      marketOpenH:     9,  marketOpenM:  15,
      marketCloseH:    15, marketCloseM: 20
    };

    // Daily counters (reset at midnight / on demand)
    this.dailyState = {
      totalSLHits:   0,
      totalPnl:      0,
      tradingHalted: false,
      haltReason:    null,
      stockSLHits:   {},   // symbol → int
      stockPnl:      {},   // symbol → ₹
      ordersToday:   0
    };
  }

  // ── Validate whether a new trade can be entered ───────────
  canTrade(symbol) {
    const errors = [];

    if (!this.isMarketHours())
      errors.push('Market is closed. Trading allowed 09:15–15:20 only.');

    if (this.dailyState.tradingHalted)
      errors.push(`Trading halted: ${this.dailyState.haltReason}`);

    const slHits = this.dailyState.stockSLHits[symbol] || 0;
    if (slHits >= this.config.maxSLPerDay)
      errors.push(`${symbol}: Max SL hits (${slHits}) reached for today.`);

    const dailyLossLimit = this.getDailyLossLimit();
    if (this.dailyState.totalPnl <= -dailyLossLimit)
      errors.push(`Daily loss limit of ₹${dailyLossLimit.toFixed(0)} breached.`);

    return { allowed: errors.length === 0, errors };
  }

  // ── Record a completed trade ──────────────────────────────
  recordTrade({ symbol, pnl, reason }) {
    this.dailyState.totalPnl         += pnl;
    this.dailyState.stockPnl[symbol]  = (this.dailyState.stockPnl[symbol] || 0) + pnl;

    if (reason === 'SL_HIT') {
      this.dailyState.totalSLHits++;
      this.dailyState.stockSLHits[symbol] =
        (this.dailyState.stockSLHits[symbol] || 0) + 1;

      // Check daily loss cap
      const dailyLossLimit = this.getDailyLossLimit();
      if (this.dailyState.totalPnl <= -dailyLossLimit) {
        this._haltTrading(`Daily loss limit of ₹${dailyLossLimit.toFixed(0)} breached`);
      }
    }

    logger.info(
      `[RISK] Trade recorded: ${symbol} | PnL: ₹${pnl.toFixed(2)} | Daily: ₹${this.dailyState.totalPnl.toFixed(2)}`
    );
    this.emit('tradeRecorded', { symbol, pnl, reason, daily: { ...this.dailyState } });
  }

  // ── Calculate position size for a stock ──────────────────
  calcPositionSize(entryPrice, slPrice) {
    const { capital, leverage, riskPct } = this.config;
    const effectiveCap = capital * leverage;
    const riskAmount   = (effectiveCap * riskPct) / 100;
    const slPoints     = Math.abs(entryPrice - slPrice);
    if (slPoints <= 0) return 0;
    return Math.max(1, Math.floor(riskAmount / slPoints));
  }

  // ── Calculate SL and Target from entry ───────────────────
  calcLevels(direction, entry, orbHigh, orbLow) {
    const { rrRatio } = this.config;
    let sl, target, slPoints;

    if (direction === 'BUY') {
      sl       = orbLow;
      slPoints = entry - sl;
      target   = entry + slPoints * rrRatio;
    } else {
      sl       = orbHigh;
      slPoints = sl - entry;
      target   = entry - slPoints * rrRatio;
    }

    return {
      sl:       +sl.toFixed(2),
      target:   +target.toFixed(2),
      slPoints: +slPoints.toFixed(2),
      qty:      this.calcPositionSize(entry, sl)
    };
  }

  // ── Check market hours ────────────────────────────────────
  isMarketHours() {
    const now = new Date();
    const h   = now.getHours(), m = now.getMinutes();
    const { marketOpenH, marketOpenM, marketCloseH, marketCloseM } = this.config;
    const afterOpen  = h > marketOpenH  || (h === marketOpenH  && m >= marketOpenM);
    const beforeClose= h < marketCloseH || (h === marketCloseH && m <= marketCloseM);
    return afterOpen && beforeClose;
  }

  // ── Daily loss limit ──────────────────────────────────────
  getDailyLossLimit() {
    const { capital, leverage, riskPct, maxSLPerDay } = this.config;
    const effectiveCap = capital * leverage;
    const riskPerTrade = (effectiveCap * riskPct) / 100;
    return riskPerTrade * maxSLPerDay;
  }

  // ── Halt trading ──────────────────────────────────────────
  _haltTrading(reason) {
    this.dailyState.tradingHalted = true;
    this.dailyState.haltReason    = reason;
    logger.warn(`[RISK] 🛑 TRADING HALTED: ${reason}`);
    this.emit('tradingHalted', { reason });
  }

  // ── Resume trading (manual override) ─────────────────────
  resumeTrading() {
    this.dailyState.tradingHalted = false;
    this.dailyState.haltReason    = null;
    logger.info('[RISK] Trading resumed manually.');
    this.emit('tradingResumed');
  }

  // ── Daily reset ───────────────────────────────────────────
  dailyReset() {
    this.dailyState = {
      totalSLHits:   0,
      totalPnl:      0,
      tradingHalted: false,
      haltReason:    null,
      stockSLHits:   {},
      stockPnl:      {},
      ordersToday:   0
    };
    logger.info('[RISK] Daily state reset');
  }

  // ── Update config from frontend ───────────────────────────
  updateConfig(cfg) {
    this.config = { ...this.config, ...cfg };
    logger.info('[RISK] Config updated:', JSON.stringify(cfg));
  }

  // ── Get full status ───────────────────────────────────────
  getStatus() {
    const { capital, leverage, riskPct, rrRatio, maxSLPerDay } = this.config;
    const effectiveCap  = capital * leverage;
    const riskPerTrade  = (effectiveCap * riskPct) / 100;
    const dailyLossLimit = riskPerTrade * maxSLPerDay;

    return {
      config:          this.config,
      daily:           this.dailyState,
      computed: {
        effectiveCapital: effectiveCap,
        riskPerTrade,
        dailyLossLimit,
        dailyPnlSoFar:   this.dailyState.totalPnl,
        remaining:       dailyLossLimit + this.dailyState.totalPnl,
        isMarketHours:   this.isMarketHours()
      }
    };
  }
}

module.exports = new RiskManager();

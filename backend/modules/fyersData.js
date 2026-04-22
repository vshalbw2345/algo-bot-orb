// modules/fyersData.js — Fyers Live Data Feed v3
// Uses official fyers-api-v3 DataSocket
const EventEmitter = require('events');
const logger = require('./logger');
const candleEngine = require('./candleEngine');

class FyersDataFeed extends EventEmitter {
  constructor() {
    super();
    this.socket      = null;
    this.subscribed  = new Set();
    this.isConnected = false;
    this.lastTick    = {};
    this.appId       = null;
    this.accessToken = null;
  }

  init(appId, accessToken) {
    this.appId       = appId;
    this.accessToken = accessToken;
    logger.info('[DATA] Feed initialised');
  }

  connect() {
    if (!this.appId || !this.accessToken) {
      logger.warn('[DATA] Cannot connect — credentials not set');
      return;
    }
    try {
      const { fyersDataSocket } = require('fyers-api-v3');
      const tokenStr = `${this.appId}:${this.accessToken}`;
      this.socket = fyersDataSocket.getInstance(tokenStr, '', false);

      this.socket.on('connect', () => {
        this.isConnected = true;
        logger.info('[DATA] ✅ Fyers Data Socket connected');
        this.emit('connected');
        if (this.subscribed.size > 0) {
          this.socket.subscribe([...this.subscribed]);
        }
      });

      this.socket.on('message', (msg) => {
        if (!msg || !msg.symbol) return;
        const tick = this._normaliseTick(msg);
        this.lastTick[tick.symbol] = tick;
        this.emit('tick', { symbol: tick.symbol, tick });
      });

      this.socket.on('error', (err) => {
        logger.error('[DATA] Socket error:', err?.message || err);
        this.emit('error', err);
      });

      this.socket.on('close', () => {
        this.isConnected = false;
        logger.warn('[DATA] Socket closed');
        this.emit('disconnected');
      });

      this.socket.connect();
    } catch(err) {
      logger.error('[DATA] Connect failed:', err.message);
    }
  }

  subscribe(symbols) {
    symbols.forEach(s => this.subscribed.add(s));
    if (this.isConnected && this.socket && symbols.length > 0) {
      this.socket.subscribe(symbols);
      logger.info('[DATA] Subscribed: ' + symbols.join(', '));
    }
  }

  unsubscribe(symbols) {
    symbols.forEach(s => this.subscribed.delete(s));
    if (this.isConnected && this.socket && symbols.length > 0) {
      this.socket.unsubscribe(symbols);
    }
  }

  _normaliseTick(msg) {
    return {
      symbol: msg.symbol,
      ltp:    msg.ltp    || msg.last_traded_price || 0,
      open:   msg.open_price  || 0,
      high:   msg.high_price  || 0,
      low:    msg.low_price   || 0,
      close:  msg.prev_close_price || 0,
      volume: msg.vol_traded_today || 0,
      chg:    msg.change        || 0,
      chgPct: msg.change_perc   || 0,
      ltq:    msg.last_traded_qty || 0,
      bid:    msg.bid_price     || 0,
      ask:    msg.ask_price     || 0,
      ts:     Date.now()
    };
  }

  getLastTick(symbol) { return this.lastTick[symbol] || null; }
  getAllTicks()        { return this.lastTick; }

  disconnect() {
    if (this.socket) {
      try { this.socket.close(); } catch(_) {}
    }
    this.isConnected = false;
    logger.info('[DATA] Feed disconnected');
  }
}


this.socket.on('message', (msg) => {
  if (!msg || !msg.symbol) return;

  const tick = this._normaliseTick(msg);

  // ✅ ADD THIS LINE (IMPORTANT)
  candleEngine.update(tick.symbol, tick);

  this.lastTick[tick.symbol] = tick;
  this.emit('tick', { symbol: tick.symbol, tick });
});
module.exports = new FyersDataFeed();

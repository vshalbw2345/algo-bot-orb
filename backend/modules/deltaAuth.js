// ─────────────────────────────────────────────────────────
// modules/deltaAuth.js — Delta Exchange API v2
// Docs: https://docs.delta.exchange
// ─────────────────────────────────────────────────────────
const axios  = require('axios');
const crypto = require('crypto');
const logger = require('./logger');

const BASE_URL = 'https://api.delta.exchange';

class DeltaAuth {
  constructor() {
    this.apis = []; // [{ id, name, apiKey, apiSecret, connected, balance }]
  }

  // ── Add/update API credentials ────────────────────────
  addApi({ id, name, apiKey, apiSecret }) {
    const existing = this.apis.find(a => a.id === id);
    if (existing) {
      existing.apiKey    = apiKey;
      existing.apiSecret = apiSecret;
      existing.name      = name;
    } else {
      this.apis.push({ id, name, apiKey, apiSecret, connected: false, balance: null });
    }
    logger.info(`[DELTA] API registered: ${name}`);
  }

  removeApi(id) {
    this.apis = this.apis.filter(a => a.id !== id);
  }

  // ── Generate HMAC signature ───────────────────────────
  _sign(apiSecret, method, path, queryString, body, timestamp) {
    const message = method + timestamp + path + queryString + body;
    return crypto.createHmac('sha256', apiSecret).update(message).digest('hex');
  }

  // ── Make authenticated request ────────────────────────
  async _request(apiKey, apiSecret, method, path, params = {}, data = {}) {
    const timestamp   = Math.floor(Date.now() / 1000).toString();
    const queryString = method === 'GET' && Object.keys(params).length
      ? '?' + new URLSearchParams(params).toString() : '';
    const bodyStr = method !== 'GET' && Object.keys(data).length
      ? JSON.stringify(data) : '';
    const signature = this._sign(apiSecret, method, path, queryString, bodyStr, timestamp);

    const headers = {
      'api-key':        apiKey,
      'timestamp':      timestamp,
      'signature':      signature,
      'Content-Type':   'application/json',
      'Accept':         'application/json',
      'User-Agent':     'ALGO_VISH_BOT/1.0'
    };

    const url = BASE_URL + path + queryString;
    const res = await axios({ method, url, headers, data: bodyStr || undefined, timeout: 10000 });
    return res.data;
  }

  // ── Test connection and fetch balance ─────────────────
  async connect(id) {
    const a = this.apis.find(x => x.id === id);
    if (!a) throw new Error('API not found: ' + id);

    try {
      // Fetch wallet balances
      const res = await this._request(a.apiKey, a.apiSecret, 'GET', '/v2/wallet/balances');

      if (res.success) {
        a.connected = true;
        a.balance   = res.result || [];
        logger.info(`[DELTA] Connected: ${a.name} — ${a.balance.length} wallet entries`);
        return { success: true, balance: a.balance };
      }
      throw new Error(res.message || 'Connection failed');
    } catch (err) {
      a.connected = false;
      logger.error(`[DELTA] Connect failed ${a.name}:`, err.message);
      throw err;
    }
  }

  // ── Fetch balance for specific API ───────────────────
  async getBalance(id) {
    const a = this.apis.find(x => x.id === id);
    if (!a) throw new Error('API not found');

    const res = await this._request(a.apiKey, a.apiSecret, 'GET', '/v2/wallet/balances');
    if (res.success) {
      a.balance = res.result || [];
      return a.balance;
    }
    throw new Error(res.message || 'Balance fetch failed');
  }

  // ── Get positions ─────────────────────────────────────
  async getPositions(id) {
    const a = this.apis.find(x => x.id === id);
    if (!a) throw new Error('API not found');
    const res = await this._request(a.apiKey, a.apiSecret, 'GET', '/v2/positions/margined');
    return res.result || [];
  }

  // ── Get open orders ───────────────────────────────────
  async getOrders(id) {
    const a = this.apis.find(x => x.id === id);
    if (!a) throw new Error('API not found');
    const res = await this._request(a.apiKey, a.apiSecret, 'GET', '/v2/orders', { state: 'open' });
    return res.result || [];
  }

  // ── Place order ───────────────────────────────────────
  async placeOrder(id, { symbol, side, size, orderType = 'market_order', limitPrice }) {
    const a = this.apis.find(x => x.id === id);
    if (!a) throw new Error('API not found');

    const body = {
      product_id:   symbol,
      side:         side.toLowerCase(), // 'buy' or 'sell'
      order_type:   orderType,
      size:         size,
    };
    if (orderType === 'limit_order') body.limit_price = limitPrice?.toString();

    const res = await this._request(a.apiKey, a.apiSecret, 'POST', '/v2/orders', {}, body);
    if (res.success) return { success: true, orderId: res.result?.id, order: res.result };
    throw new Error(res.message || 'Order failed');
  }

  getStatus() {
    return this.apis.map(a => ({
      id:        a.id,
      name:      a.name,
      connected: a.connected,
      balance:   a.balance
    }));
  }

  getApi(id) { return this.apis.find(a => a.id === id) || null; }
}

module.exports = new DeltaAuth();

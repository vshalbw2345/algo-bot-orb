// ─────────────────────────────────────────────────────────
// modules/deltaAuth.js — Delta Exchange API v2
// ─────────────────────────────────────────────────────────
const axios  = require('axios');
const crypto = require('crypto');
const logger = require('./logger');

const BASE_URL = 'https://api.delta.exchange';

class DeltaAuth {
  constructor() {
    this.apis = [];
  }

  addApi({ id, name, apiKey, apiSecret }) {
    const existing = this.apis.find(a => a.id === id);
    if (existing) {
      existing.apiKey    = apiKey;
      existing.apiSecret = apiSecret;
      existing.name      = name;
    } else {
      this.apis.push({ id, name, apiKey, apiSecret, connected: false, balance: null, availableBalance: 0 });
    }
  }

  removeApi(id) {
    this.apis = this.apis.filter(a => a.id !== id);
  }

  // ── Delta Exchange signature (exact format from official docs) ──
  _sign(apiSecret, method, path, queryString, body, timestamp) {
    // Format: method + timestamp + /path + query_string + body
    // query_string: empty string if no params, else '?key=val&...' WITHOUT leading ?
    const signatureData = method + timestamp + path + queryString + body;
    logger.info(`[DELTA] Signing: ${signatureData.substring(0, 80)}...`);
    return crypto.createHmac('sha256', apiSecret).update(signatureData).digest('hex');
  }

  async _request(apiKey, apiSecret, method, path, params = {}, data = null) {
    const timestamp = Math.floor(Date.now() / 1000).toString();

    // Build query string (without leading ?)
    const qsObj = method === 'GET' ? params : {};
    const queryString = Object.keys(qsObj).length
      ? Object.keys(qsObj).map(k => `${k}=${qsObj[k]}`).join('&')
      : '';

    // Build body
    const bodyStr = (method !== 'GET' && data) ? JSON.stringify(data) : '';

    // Sign — queryString passed without ? prefix
    const signature = this._sign(apiSecret, method, path, queryString ? '?' + queryString : '', bodyStr, timestamp);

    const headers = {
      'api-key':      apiKey,
      'timestamp':    timestamp,
      'signature':    signature,
      'Content-Type': 'application/json',
      'User-Agent':   'ALGO_VISH/1.0'
    };

    const url = BASE_URL + path + (queryString ? '?' + queryString : '');
    logger.info(`[DELTA] ${method} ${url}`);

    const res = await axios({
      method,
      url,
      headers,
      data: bodyStr || undefined,
      timeout: 15000
    });

    return res.data;
  }

  async connect(id) {
    const a = this.apis.find(x => x.id === id);
    if (!a) throw new Error('API not found: ' + id);

    try {
      const res = await this._request(a.apiKey, a.apiSecret, 'GET', '/v2/wallet/balances');
      logger.info(`[DELTA] Balance response: ${JSON.stringify(res).substring(0, 200)}`);

      if (res.success) {
        a.connected = true;
        a.balance   = res.result || [];
        // Find USDT balance
        let avail = 0;
        for (const b of a.balance) {
          const sym = (b.asset_symbol || b.currency || '').toUpperCase();
          const val = parseFloat(b.available_balance || b.balance || 0);
          if ((sym === 'USDT' || sym === 'USD') && val >= 0) { avail = val; break; }
        }
        if (avail === 0 && a.balance.length > 0) {
          avail = parseFloat(a.balance[0].available_balance || a.balance[0].balance || 0);
        }
        a.availableBalance = avail;
        logger.info(`[DELTA] ✅ Connected: ${a.name} balance=$${avail}`);
        return { success: true, balance: a.balance, availableBalance: avail };
      }
      throw new Error(res.message || JSON.stringify(res));
    } catch (err) {
      a.connected = false;
      // Extract detailed error message from Axios response
      let errMsg = err.message;
      if (err.response) {
        const d = err.response.data;
        errMsg = d?.error?.message || d?.message || d?.error || JSON.stringify(d) || err.message;
        logger.error(`[DELTA] ❌ HTTP ${err.response.status}: ${JSON.stringify(err.response.data)}`);
      } else {
        logger.error(`[DELTA] ❌ Connect failed: ${err.message}`);
      }
      throw new Error(errMsg);
    }
  }

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

  async getPositions(id) {
    const a = this.apis.find(x => x.id === id);
    if (!a) throw new Error('API not found');
    const res = await this._request(a.apiKey, a.apiSecret, 'GET', '/v2/positions/margined');
    return res.result || [];
  }

  async placeOrder(id, { productId, side, size, orderType = 'market_order', limitPrice }) {
    const a = this.apis.find(x => x.id === id);
    if (!a) throw new Error('API not found');
    const body = { product_id: productId, side: side.toLowerCase(), order_type: orderType, size };
    if (orderType === 'limit_order' && limitPrice) body.limit_price = String(limitPrice);
    const res = await this._request(a.apiKey, a.apiSecret, 'POST', '/v2/orders', {}, body);
    if (res.success) return { success: true, orderId: res.result?.id, order: res.result };
    throw new Error(res.message || 'Order failed');
  }

  getStatus() {
    return this.apis.map(a => ({
      id: a.id, name: a.name, connected: a.connected,
      balance: a.balance, availableBalance: a.availableBalance
    }));
  }

  getApi(id) { return this.apis.find(a => a.id === id) || null; }
}

module.exports = new DeltaAuth();

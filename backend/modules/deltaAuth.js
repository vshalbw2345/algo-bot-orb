// modules/deltaAuth.js — Delta Exchange API v2
const axios  = require('axios');
const crypto = require('crypto');
const logger = require('./logger');

// India users use: https://api.india.delta.exchange
// Global users use: https://api.delta.exchange
const BASE_URLS = {
  india:  'https://api.india.delta.exchange',
  global: 'https://api.delta.exchange'
};

class DeltaAuth {
  constructor() {
    this.apis = [];
  }

  addApi({ id, name, apiKey, apiSecret, region }) {
    const existing = this.apis.find(a => a.id === id);
    const baseUrl = BASE_URLS[region] || BASE_URLS.india; // default India
    if (existing) {
      existing.apiKey    = apiKey;
      existing.apiSecret = apiSecret;
      existing.name      = name;
      existing.baseUrl   = baseUrl;
      existing.region    = region || 'india';
    } else {
      this.apis.push({
        id, name, apiKey, apiSecret,
        region: region || 'india',
        baseUrl,
        connected: false, balance: null, availableBalance: 0
      });
    }
    logger.info(`[DELTA] API registered: ${name} → ${baseUrl}`);
  }

  removeApi(id) { this.apis = this.apis.filter(a => a.id !== id); }

  // Signature: method + timestamp + path + queryString + body
  _sign(secret, method, path, queryString, body, timestamp) {
    const msg = method + timestamp + path + queryString + body;
    return crypto.createHmac('sha256', secret).update(msg).digest('hex');
  }

  async _request(a, method, path, params = {}, data = null) {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const qs = Object.keys(params).length
      ? '?' + Object.entries(params).map(([k,v])=>`${k}=${v}`).join('&')
      : '';
    const bodyStr = (method !== 'GET' && data) ? JSON.stringify(data) : '';
    const sig = this._sign(a.apiSecret, method, path, qs, bodyStr, timestamp);

    const headers = {
      'api-key':      a.apiKey,
      'timestamp':    timestamp,
      'signature':    sig,
      'Content-Type': 'application/json',
      'User-Agent':   'algo-vish/1.0'
    };

    const url = a.baseUrl + path + qs;
    logger.info(`[DELTA] ${method} ${url}`);

    const res = await axios({ method, url, headers, data: bodyStr||undefined, timeout:15000 });
    return res.data;
  }

  async connect(id) {
    const a = this.apis.find(x => x.id === id);
    if (!a) throw new Error('API not found');
    try {
      const res = await this._request(a, 'GET', '/v2/wallet/balances');
      if (res.success) {
        a.connected = true;
        a.balance   = res.result || [];
        let avail = 0;
        for (const b of a.balance) {
          const sym = (b.asset_symbol||'').toUpperCase();
          const val = parseFloat(b.available_balance || b.balance || 0);
          if (sym === 'USDT' || sym === 'USD' || sym === 'INR') { avail = val; break; }
        }
        if (avail === 0 && a.balance.length > 0)
          avail = parseFloat(a.balance[0].available_balance || a.balance[0].balance || 0);
        a.availableBalance = avail;
        logger.info(`[DELTA] ✅ ${a.name} connected. Balance: ${avail}`);
        return { success:true, balance:a.balance, availableBalance:avail };
      }
      throw new Error(JSON.stringify(res.error || res));
    } catch(err) {
      a.connected = false;
      const d = err.response?.data;
      const msg = d?.error?.code || d?.error?.message || d?.message || err.message;
      logger.error(`[DELTA] ❌ ${a.name}: HTTP ${err.response?.status} — ${JSON.stringify(d)}`);
      throw new Error(String(msg));
    }
  }

  async getBalance(id) {
    const a = this.apis.find(x => x.id === id);
    if (!a) throw new Error('API not found');
    const res = await this._request(a, 'GET', '/v2/wallet/balances');
    if (res.success) { a.balance = res.result||[]; return a.balance; }
    throw new Error(JSON.stringify(res.error||res));
  }

  async getPositions(id) {
    const a = this.apis.find(x => x.id === id);
    if (!a) throw new Error('API not found');
    const res = await this._request(a, 'GET', '/v2/positions/margined');
    return res.result || [];
  }

  async placeOrder(id, { productId, side, size, orderType='market_order', limitPrice }) {
    const a = this.apis.find(x => x.id === id);
    if (!a) throw new Error('API not found');
    const body = { product_id: productId, side: side.toLowerCase(), order_type: orderType, size: parseInt(size) };
    if (orderType === 'limit_order' && limitPrice) body.limit_price = String(limitPrice);
    const res = await this._request(a, 'POST', '/v2/orders', {}, body);
    if (res.success) return { success:true, orderId:res.result?.id, order:res.result };
    throw new Error(JSON.stringify(res.error||res));
  }

  getStatus() {
    return this.apis.map(a=>({
      id:a.id, name:a.name, connected:a.connected,
      balance:a.balance, availableBalance:a.availableBalance, region:a.region
    }));
  }

  getApi(id) { return this.apis.find(a=>a.id===id)||null; }
}

module.exports = new DeltaAuth();

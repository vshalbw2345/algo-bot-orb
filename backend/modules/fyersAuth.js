// modules/fyersAuth.js — Fyers API v3 (Official npm package)
const { fyersModel } = require('fyers-api-v3');
const logger = require('./logger');

class FyersAuth {
  constructor() {
    this.appId       = process.env.FYERS_APP_ID;
    this.secretKey   = process.env.FYERS_SECRET_KEY;
    this.redirectUri = process.env.FYERS_REDIRECT_URI;
    this.accessToken = null;
    this.tokenExpiry = null;
    this.profile     = null;
    this.isAuthenticated = false;
    this.fyers       = null;
  }

  getAuthUrl() {
    if (!this.appId || !this.secretKey) {
      throw new Error('FYERS_APP_ID and FYERS_SECRET_KEY must be set in .env');
    }
    const fyers = new fyersModel({ enableLogging: false });
    fyers.setAppId(this.appId);
    fyers.setRedirectUrl(this.redirectUri);
    const url = fyers.generateAuthCode();
    logger.info('[AUTH] Auth URL generated');
    return url;
  }

  async validateAuthCode(authCode) {
    try {
      const fyers = new fyersModel({ enableLogging: false });
      fyers.setAppId(this.appId);
      fyers.setRedirectUrl(this.redirectUri);
      const response = await fyers.generate_access_token({
        client_id: this.appId, secret_key: this.secretKey, auth_code: authCode
      });
      if (response.s === 'ok' && response.access_token) {
        this.accessToken     = response.access_token;
        this.tokenExpiry     = Date.now() + 23.5 * 60 * 60 * 1000;
        this.isAuthenticated = true;
        this.fyers = new fyersModel({ enableLogging: false });
        this.fyers.setAppId(this.appId);
        this.fyers.setRedirectUrl(this.redirectUri);
        this.fyers.setAccessToken(response.access_token);
        logger.info('[AUTH] Access token obtained');
        await this.fetchProfile();
        return { success: true, token: this.accessToken };
      }
      throw new Error(response.message || JSON.stringify(response));
    } catch (err) {
      logger.error('[AUTH] validateAuthCode failed:', err.message);
      throw err;
    }
  }

  async fetchProfile() {
    try {
      if (!this.fyers) return;
      const res = await this.fyers.get_profile();
      if (res.s === 'ok' && res.data) {
        this.profile = res.data;
        logger.info('[AUTH] Profile: ' + this.profile.name);
      }
    } catch (err) { logger.warn('[AUTH] Profile fetch failed:', err.message); }
  }

  async getQuotes(symbols) {
    if (!this.fyers) throw new Error('Not authenticated');
    const res = await this.fyers.getQuotes({ symbols: symbols.join(',') });
    return res.d || [];
  }

  async getHistory({ symbol, resolution, rangeFrom, rangeTo }) {
    if (!this.fyers) throw new Error('Not authenticated');
    const res = await this.fyers.getHistory({ symbol, resolution, date_format:1, range_from:rangeFrom, range_to:rangeTo, cont_flag:1 });
    return res.candles || [];
  }

  async getPositions() {
    if (!this.fyers) throw new Error('Not authenticated');
    const res = await this.fyers.get_positions();
    return res.netPositions || [];
  }

  async getOrders() {
    if (!this.fyers) throw new Error('Not authenticated');
    const res = await this.fyers.get_orders();
    return res.orderBook || [];
  }

  async getFunds() {
    if (!this.fyers) throw new Error('Not authenticated');
    const res = await this.fyers.get_funds();
    return res.fund_limit || [];
  }

  async placeOrder(orderData) {
    if (!this.fyers) throw new Error('Not authenticated');
    return await this.fyers.place_order(orderData);
  }

  async modifyOrder(orderData) {
    if (!this.fyers) throw new Error('Not authenticated');
    return await this.fyers.modify_order(orderData);
  }

  async cancelOrder(orderId) {
    if (!this.fyers) throw new Error('Not authenticated');
    return await this.fyers.cancel_order({ id: orderId });
  }

  getHeaders() {
    if (!this.accessToken) throw new Error('Not authenticated');
    return { Authorization: this.appId + ':' + this.accessToken };
  }

  setToken(token) {
    this.accessToken     = token;
    this.isAuthenticated = true;
    this.tokenExpiry     = Date.now() + 23.5 * 60 * 60 * 1000;
    this.fyers = new fyersModel({ enableLogging: false });
    this.fyers.setAppId(this.appId);
    this.fyers.setRedirectUrl(this.redirectUri);
    this.fyers.setAccessToken(token);
    logger.info('[AUTH] Token set manually');
  }

  isTokenValid() {
    return this.isAuthenticated && this.accessToken && Date.now() < (this.tokenExpiry || 0);
  }

  getStatus() {
    return {
      isAuthenticated: this.isAuthenticated,
      isTokenValid:    this.isTokenValid(),
      expiresAt:       this.tokenExpiry ? new Date(this.tokenExpiry).toISOString() : null,
      profile:         this.profile ? { name: this.profile.name, email: this.profile.email_id } : null
    };
  }
}

module.exports = new FyersAuth();

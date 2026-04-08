// ─────────────────────────────────────────────────────────
// modules/orderExecutor.js — Fyers Order Execution Engine
//
// Places, modifies, and cancels orders via Fyers API v2
// Handles bracket orders, SL modification, and order tracking
// ─────────────────────────────────────────────────────────
const axios       = require('axios');
const EventEmitter = require('events');
const logger      = require('./logger');
const fyersAuth   = require('./fyersAuth');

const FYERS_API_BASE = 'https://api.fyers.in/api/v2';

// Fyers order type codes
const ORDER_TYPE = { LIMIT: 1, MARKET: 2, STOP_LOSS: 3, STOP_LOSS_MARKET: 4 };
const SIDE       = { BUY: 1, SELL: -1 };
const PRODUCT    = { INTRADAY: 'INTRADAY', CNC: 'CNC', MARGIN: 'MARGIN' };

class OrderExecutor extends EventEmitter {
  constructor() {
    super();
    this.openOrders    = {};   // orderId → order details
    this.orderHistory  = [];   // all orders (max 500)
    this.slOrderMap    = {};   // parentOrderId → slOrderId
    this.tgtOrderMap   = {};   // parentOrderId → targetOrderId
  }

  // ── Place entry order ─────────────────────────────────────
  async placeOrder({ symbol, side, qty, orderType = 'MARKET', price = 0, productType = 'INTRADAY' }) {
    try {
      const payload = {
        symbol,
        qty:         qty,
        type:        ORDER_TYPE[orderType] || ORDER_TYPE.MARKET,
        side:        SIDE[side],
        productType: PRODUCT[productType] || PRODUCT.INTRADAY,
        limitPrice:  orderType === 'LIMIT' ? price : 0,
        stopPrice:   0,
        disclosedQty: 0,
        validity:    'DAY',
        offlineOrder: false,
        stopLoss:    0,
        takeProfit:  0
      };

      logger.info(`[ORDER] Placing ${side} ${qty} ${symbol} @ ${orderType}`);
      const res = await this._post('/orders', payload);

      if (res.code === 200 || res.s === 'ok') {
        const orderId = res.id;
        const order   = {
          orderId,
          symbol,
          side,
          qty,
          orderType,
          price,
          productType,
          status:    'PENDING',
          placedAt:  new Date().toISOString(),
          fillPrice: null,
          fillQty:   null
        };
        this.openOrders[orderId] = order;
        this._addHistory(order);
        logger.info(`[ORDER] ✅ Order placed. ID: ${orderId}`);
        this.emit('orderPlaced', order);
        return { success: true, orderId, order };
      }

      throw new Error(res.message || 'Order placement failed');
    } catch (err) {
      logger.error('[ORDER] Place order failed:', err.message);
      this.emit('orderError', { symbol, side, error: err.message });
      return { success: false, error: err.message };
    }
  }

  // ── Place entry + SL + Target as 3 separate orders ────────
  async placeORBTrade({ symbol, direction, entry, sl, target, qty }) {
    const results = {};

    // Entry order (Market)
    const entryResult = await this.placeOrder({
      symbol,
      side:        direction,
      qty,
      orderType:   'MARKET',
      productType: process.env.PRODUCT_TYPE || 'INTRADAY'
    });
    results.entry = entryResult;
    if (!entryResult.success) return results;

    // Wait briefly for entry fill
    await this._delay(1500);

    // SL order (Stop Loss Market — triggers if price moves against)
    const slSide = direction === 'BUY' ? 'SELL' : 'BUY';
    const slResult = await this.placeOrder({
      symbol,
      side:        slSide,
      qty,
      orderType:   'STOP_LOSS_MARKET',
      price:       sl,
      productType: process.env.PRODUCT_TYPE || 'INTRADAY'
    });
    results.sl = slResult;
    if (slResult.success) this.slOrderMap[entryResult.orderId] = slResult.orderId;

    // Target order (Limit order at target price)
    const tgtResult = await this.placeOrder({
      symbol,
      side:        slSide,
      qty,
      orderType:   'LIMIT',
      price:       target,
      productType: process.env.PRODUCT_TYPE || 'INTRADAY'
    });
    results.target = tgtResult;
    if (tgtResult.success) this.tgtOrderMap[entryResult.orderId] = tgtResult.orderId;

    logger.info(`[ORDER] ORB Trade placed for ${symbol}. Entry:${entryResult.orderId}`);
    this.emit('orbTradePlaced', { symbol, direction, results });
    return results;
  }

  // ── Modify SL (for trailing) ──────────────────────────────
  async modifyStopLoss(orderId, newStopPrice) {
    try {
      const payload = {
        id:        orderId,
        type:      ORDER_TYPE.STOP_LOSS_MARKET,
        limitPrice: 0,
        stopPrice: newStopPrice,
        qty:       this.openOrders[orderId]?.qty
      };
      const res = await this._put('/orders', payload);
      if (res.code === 200 || res.s === 'ok') {
        logger.info(`[ORDER] SL modified → ${newStopPrice} for order ${orderId}`);
        this.emit('slModified', { orderId, newStopPrice });
        return { success: true };
      }
      throw new Error(res.message);
    } catch (err) {
      logger.error('[ORDER] Modify SL failed:', err.message);
      return { success: false, error: err.message };
    }
  }

  // ── Cancel order ──────────────────────────────────────────
  async cancelOrder(orderId) {
    try {
      const res = await this._delete(`/orders/${orderId}`);
      if (res.code === 200 || res.s === 'ok') {
        if (this.openOrders[orderId]) {
          this.openOrders[orderId].status = 'CANCELLED';
        }
        logger.info(`[ORDER] Order cancelled: ${orderId}`);
        this.emit('orderCancelled', { orderId });
        return { success: true };
      }
      throw new Error(res.message);
    } catch (err) {
      logger.error('[ORDER] Cancel failed:', err.message);
      return { success: false, error: err.message };
    }
  }

  // ── Cancel all open orders for symbol ────────────────────
  async cancelAllForSymbol(symbol) {
    const toCancel = Object.values(this.openOrders)
      .filter(o => o.symbol === symbol && o.status === 'PENDING');
    for (const o of toCancel) {
      await this.cancelOrder(o.orderId);
    }
  }

  // ── Market exit position ──────────────────────────────────
  async exitPosition(symbol, side, qty) {
    // Cancel existing SL and Target orders first
    await this.cancelAllForSymbol(symbol);
    // Place market exit
    return this.placeOrder({
      symbol,
      side:      side === 'BUY' ? 'SELL' : 'BUY',
      qty,
      orderType: 'MARKET',
      productType: process.env.PRODUCT_TYPE || 'INTRADAY'
    });
  }

  // ── Test signal (paper trade — no real order) ─────────────
  async testSignal({ symbol, side, qty, orderType = 'MARKET', price = 0 }) {
    const mockOrderId = 'TEST_' + Date.now();
    const order = {
      orderId:   mockOrderId,
      symbol,
      side,
      qty,
      orderType,
      price,
      status:    'SIMULATED',
      placedAt:  new Date().toISOString(),
      message:   'Test signal — no real order placed'
    };
    this._addHistory(order);
    logger.info(`[ORDER] 🧪 Test signal: ${side} ${qty} ${symbol} → ${mockOrderId}`);
    this.emit('testSignal', order);
    return { success: true, orderId: mockOrderId, order, simulated: true };
  }

  // ── Sync order status from Fyers (poll) ──────────────────
  async syncOrderStatus() {
    try {
      const orders = await fyersAuth.getOrders();
      orders.forEach(o => {
        const id = o.id;
        if (this.openOrders[id]) {
          this.openOrders[id].status    = o.status === 2 ? 'FILLED' : o.status === 5 ? 'CANCELLED' : 'PENDING';
          this.openOrders[id].fillPrice = o.tradedPrice;
          this.openOrders[id].fillQty   = o.filledQty;
          if (this.openOrders[id].status !== 'PENDING') {
            this.emit('orderUpdate', this.openOrders[id]);
          }
        }
      });
    } catch (err) {
      logger.warn('[ORDER] Sync failed:', err.message);
    }
  }

  // ── Get open orders ───────────────────────────────────────
  getOpenOrders()  { return Object.values(this.openOrders); }
  getHistory()     { return this.orderHistory.slice(-100); }

  // ── Helpers ───────────────────────────────────────────────
  _addHistory(order) {
    this.orderHistory.push({ ...order, recordedAt: new Date().toISOString() });
    if (this.orderHistory.length > 500) this.orderHistory.shift();
  }

  async _post(endpoint, data) {
    const res = await axios.post(`${FYERS_API_BASE}${endpoint}`, data, {
      headers: fyersAuth.getHeaders(), timeout: 10000
    });
    return res.data;
  }

  async _put(endpoint, data) {
    const res = await axios.put(`${FYERS_API_BASE}${endpoint}`, data, {
      headers: fyersAuth.getHeaders(), timeout: 10000
    });
    return res.data;
  }

  async _delete(endpoint) {
    const res = await axios.delete(`${FYERS_API_BASE}${endpoint}`, {
      headers: fyersAuth.getHeaders(), timeout: 10000
    });
    return res.data;
  }

  _delay(ms) { return new Promise(r => setTimeout(r, ms)); }
}

module.exports = new OrderExecutor();

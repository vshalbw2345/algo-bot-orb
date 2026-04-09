// ─────────────────────────────────────────────────────────
// modules/orderExecutor.js — Fyers Order Execution
// Uses fyersAuth.fyers (official fyers-api-v3 instance)
// ─────────────────────────────────────────────────────────
const EventEmitter = require('events');
const logger       = require('./logger');
const fyersAuth    = require('./fyersAuth');

// Fyers API v3 type codes
const ORDER_TYPE = { MARKET:2, LIMIT:1, STOP_LOSS:4, STOP_LOSS_MARKET:3 };
const SIDE       = { BUY:1, SELL:-1 };

class OrderExecutor extends EventEmitter {
  constructor() {
    super();
    this.openOrders   = {};
    this.orderHistory = [];
    this.slOrderMap   = {};
    this.tgtOrderMap  = {};
  }

  // ── Place single order via Fyers API v3 ──────────────────
  async placeOrder({ symbol, side, qty, orderType='MARKET', price=0, productType='INTRADAY' }) {
    try {
      if (!fyersAuth.fyers) throw new Error('Fyers not authenticated');

      const payload = {
        symbol,
        qty,
        type:        ORDER_TYPE[orderType] || 2,
        side:        SIDE[side] || 1,
        productType: productType || 'INTRADAY',
        limitPrice:  orderType === 'LIMIT' ? price : 0,
        stopPrice:   orderType === 'STOP_LOSS' || orderType === 'STOP_LOSS_MARKET' ? price : 0,
        disclosedQty: 0,
        validity:    'DAY',
        offlineOrder: false,
        stopLoss:    0,
        takeProfit:  0
      };

      logger.info(`[ORDER] Placing ${side} ${qty} ${symbol} @ ${orderType}`);
      const res = await fyersAuth.fyers.place_order(payload);

      if (res.s === 'ok' || res.code === 200) {
        const orderId = res.id;
        const order = { orderId, symbol, side, qty, orderType, price, productType,
          status:'PENDING', placedAt:new Date().toISOString() };
        this.openOrders[orderId] = order;
        this._addHistory(order);
        logger.info(`[ORDER] ✅ Order placed: ${orderId}`);
        this.emit('orderPlaced', order);
        return { success:true, orderId, order };
      }

      throw new Error(res.message || JSON.stringify(res));
    } catch(err) {
      logger.error('[ORDER] Place failed:', err.message);
      this.emit('orderError', { symbol, side, error:err.message });
      return { success:false, error:err.message };
    }
  }

  // ── Place ORB trade: entry + SL + Target ─────────────────
  async placeORBTrade({ symbol, direction, entry, sl, target, qty }) {
    const results = {};

    // Entry order
    const entryResult = await this.placeOrder({
      symbol, side:direction, qty, orderType:'MARKET',
      productType: process.env.PRODUCT_TYPE || 'INTRADAY'
    });
    results.entry = entryResult;
    if (!entryResult.success) return results;

    await this._delay(1500);

    // SL order
    const slSide = direction === 'BUY' ? 'SELL' : 'BUY';
    const slResult = await this.placeOrder({
      symbol, side:slSide, qty, orderType:'STOP_LOSS_MARKET',
      price:sl, productType: process.env.PRODUCT_TYPE || 'INTRADAY'
    });
    results.sl = slResult;
    if (slResult.success) this.slOrderMap[entryResult.orderId] = slResult.orderId;

    // Target order
    const tgtResult = await this.placeOrder({
      symbol, side:slSide, qty, orderType:'LIMIT',
      price:target, productType: process.env.PRODUCT_TYPE || 'INTRADAY'
    });
    results.target = tgtResult;
    if (tgtResult.success) this.tgtOrderMap[entryResult.orderId] = tgtResult.orderId;

    this.emit('orbTradePlaced', { symbol, direction, results });
    return results;
  }

  // ── Modify SL order ───────────────────────────────────────
  async modifyStopLoss(orderId, newStopPrice) {
    try {
      if (!fyersAuth.fyers) throw new Error('Not authenticated');
      const res = await fyersAuth.fyers.modify_order({
        id: orderId, type:3, stopPrice: newStopPrice,
        qty: this.openOrders[orderId]?.qty
      });
      if (res.s === 'ok') {
        logger.info(`[ORDER] SL modified → ${newStopPrice}`);
        this.emit('slModified', { orderId, newStopPrice });
        return { success:true };
      }
      throw new Error(res.message);
    } catch(err) {
      logger.error('[ORDER] Modify SL failed:', err.message);
      return { success:false, error:err.message };
    }
  }

  // ── Cancel order ──────────────────────────────────────────
  async cancelOrder(orderId) {
    try {
      if (!fyersAuth.fyers) throw new Error('Not authenticated');
      const res = await fyersAuth.fyers.cancel_order({ id: orderId });
      if (res.s === 'ok') {
        if (this.openOrders[orderId]) this.openOrders[orderId].status = 'CANCELLED';
        this.emit('orderCancelled', { orderId });
        return { success:true };
      }
      throw new Error(res.message);
    } catch(err) {
      return { success:false, error:err.message };
    }
  }

  // ── Cancel all orders for a symbol ───────────────────────
  async cancelAllForSymbol(symbol) {
    const toCancel = Object.values(this.openOrders)
      .filter(o => o.symbol === symbol && o.status === 'PENDING');
    for (const o of toCancel) await this.cancelOrder(o.orderId);
  }

  // ── Market exit ───────────────────────────────────────────
  async exitPosition(symbol, side, qty) {
    await this.cancelAllForSymbol(symbol);
    return this.placeOrder({
      symbol, side: side==='BUY'?'SELL':'BUY',
      qty, orderType:'MARKET',
      productType: process.env.PRODUCT_TYPE || 'INTRADAY'
    });
  }

  // ── Test signal (simulated) ───────────────────────────────
  async testSignal({ symbol, side, qty, orderType='MARKET', price=0 }) {
    const mockOrderId = 'TEST_' + Date.now();
    const order = {
      orderId:  mockOrderId, symbol, side, qty, orderType, price,
      status:   'SIMULATED', placedAt: new Date().toISOString(),
      message:  'Test signal — no real order placed'
    };
    this._addHistory(order);
    logger.info(`[ORDER] 🧪 Test: ${side} ${qty} ${symbol}`);
    this.emit('testSignal', order);
    return { success:true, orderId:mockOrderId, order, simulated:true };
  }

  // ── Sync order status ─────────────────────────────────────
  async syncOrderStatus() {
    try {
      if (!fyersAuth.fyers) return;
      const res = await fyersAuth.fyers.get_orders();
      const orders = res.orderBook || [];
      orders.forEach(o => {
        const id = o.id;
        if (this.openOrders[id]) {
          this.openOrders[id].status    = o.status===2?'FILLED':o.status===5?'CANCELLED':'PENDING';
          this.openOrders[id].fillPrice = o.tradedPrice;
          if (this.openOrders[id].status !== 'PENDING') this.emit('orderUpdate', this.openOrders[id]);
        }
      });
    } catch(_) {}
  }

  getOpenOrders() { return Object.values(this.openOrders); }
  getHistory()    { return this.orderHistory.slice(-100); }

  _addHistory(order) {
    this.orderHistory.push({ ...order, recordedAt: new Date().toISOString() });
    if (this.orderHistory.length > 500) this.orderHistory.shift();
  }

  _delay(ms) { return new Promise(r => setTimeout(r, ms)); }
}

module.exports = new OrderExecutor();

// ─────────────────────────────────────────────────────────
// server.js — ALGO_BOT_ORB Main Server
//
// Starts:
//   • Express REST API
//   • Socket.io real-time channel
//   • Fyers data feed
//   • ORB engine
//   • Risk manager
//   • Scheduler (cron jobs)
// ─────────────────────────────────────────────────────────
require('dotenv').config();
const fs            = require('fs');
const path          = require('path');
const express       = require('express');
const http          = require('http');
const { Server }    = require('socket.io');
const cors          = require('cors');
const helmet        = require('helmet');
const morgan        = require('morgan');
const rateLimit     = require('express-rate-limit');

const logger        = require('./modules/logger');
const fyersAuth     = require('./modules/fyersAuth');
const deltaAuth     = require('./modules/deltaAuth');
const fyersData     = require('./modules/fyersData');
const orbEngine     = require('./modules/orbEngine');
const orderExecutor = require('./modules/orderExecutor');
const riskManager   = require('./modules/riskManager');
const scheduler     = require('./modules/scheduler');

// ── Ensure log dir ────────────────────────────────────────
if (!fs.existsSync('logs')) fs.mkdirSync('logs');

// ── Express App ───────────────────────────────────────────
const app    = express();
const server = http.createServer(app);

// ── Socket.io ────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin:  '*',
    methods: ['GET', 'POST'],
    credentials: false
  },
  transports: ['websocket', 'polling']
});

// ── Middleware ────────────────────────────────────────────
app.set('trust proxy', 1);  // Trust Render.com proxy
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: '*', credentials: false }));
app.use(express.json());
app.use(morgan('tiny'));

const limiter = rateLimit({ 
  windowMs: 60000, max: 200,
  validate: { xForwardedForHeader: false }  // Fix for Render.com proxy
});
app.use('/api/', limiter);

// ── Persistent State File ────────────────────────────────
const STATE_FILE = path.join(__dirname, 'state.json');

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
      logger.info('[STATE] Loaded from file: ' + (data.selectedSymbols||[]).length + ' stocks');
      return data;
    }
  } catch(e) { logger.warn('[STATE] Could not load state:', e.message); }
  return {};
}

function saveState() {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify({
      selectedSymbols, stockToggles, rrConfig, masterEnabled
    }, null, 2));
  } catch(e) { logger.warn('[STATE] Could not save state:', e.message); }
}

// ── State ─────────────────────────────────────────────────
const savedState    = loadState();
let selectedSymbols = savedState.selectedSymbols || [];
let masterEnabled   = savedState.masterEnabled   || false;
let stockToggles    = savedState.stockToggles    || {};
let rrConfig        = savedState.rrConfig        || {
  capital: 50000, leverage: 5, riskPct: 2, rrRatio: 2, maxSLPerDay: 3
};
let alertLog        = [];

logger.info('[STATE] Starting with ' + selectedSymbols.length + ' stocks: ' + selectedSymbols.join(', '));

// ── Helper: broadcast to all Socket.io clients ────────────
const emit = (event, data) => io.emit(event, { ...data, ts: new Date().toISOString() });

// ─────────────────────────────────────────────────────────
// REST ROUTES
// ─────────────────────────────────────────────────────────

// ── Auth ──────────────────────────────────────────────────
app.get('/api/auth/url', (req, res) => {
  try {
    const url = fyersAuth.getAuthUrl();
    res.json({ success: true, url });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/auth/callback', async (req, res) => {
  const { auth_code, code } = req.query;
  const authCode = auth_code || code;
  if (!authCode) return res.status(400).json({ error: 'auth_code missing' });

  try {
    const result = await fyersAuth.validateAuthCode(authCode);
    // Init data feed
    fyersData.init(process.env.FYERS_APP_ID, fyersAuth.accessToken);
    fyersData.connect();

    // Auto-subscribe saved stocks after auth
    setTimeout(() => {
      if (selectedSymbols.length > 0) {
        fyersData.subscribe(selectedSymbols);
        logger.info('[SERVER] Auto-subscribed ' + selectedSymbols.length + ' saved stocks');
      }
    }, 3000);

    emit('authSuccess', { profile: fyersAuth.profile });
    // Redirect to frontend — auto-detect port
    const port = process.env.PORT || 5000;
    const frontendUrl = process.env.FRONTEND_URL || `http://localhost:${port}`;
    res.redirect(`${frontendUrl}/?auth=success`);
  } catch (err) {
    logger.error('[SERVER] Auth callback error:', err.message);
    const port = process.env.PORT || 5000;
    const frontendUrl = process.env.FRONTEND_URL || `http://localhost:${port}`;
    res.redirect(`${frontendUrl}/?auth=failed&reason=${encodeURIComponent(err.message)}`);
  }
});

app.get('/api/auth/status', (req, res) => {
  res.json({ success: true, ...fyersAuth.getStatus() });
});

app.post('/api/auth/token', (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'token required' });
  fyersAuth.setToken(token);
  fyersData.init(process.env.FYERS_APP_ID, token);
  fyersData.connect();
  emit('authSuccess', { manual: true });
  res.json({ success: true, message: 'Token set. Feed connecting...' });
});

// ── Update Fyers credentials from frontend ─────────────────
app.post('/api/auth/credentials', (req, res) => {
  const { appId, secretKey, redirectUri } = req.body;
  if (!appId || !secretKey) return res.status(400).json({ error: 'appId and secretKey required' });
  // Update fyersAuth credentials
  fyersAuth.appId      = appId;
  fyersAuth.secretKey  = secretKey;
  fyersAuth.redirectUri = redirectUri || fyersAuth.redirectUri;
  // Also update env so getAuthUrl uses new creds
  process.env.FYERS_APP_ID       = appId;
  process.env.FYERS_SECRET_KEY   = secretKey;
  if (redirectUri) process.env.FYERS_REDIRECT_URI = redirectUri;
  logger.info('[AUTH] Credentials updated: ' + appId);
  res.json({ success: true, message: 'Credentials updated. Now click Login to Fyers.' });
});

// ── Stocks ────────────────────────────────────────────────
app.post('/api/stocks/select', (req, res) => {
  // { symbols: ["NSE:RELIANCE-EQ", ...], toggles: {"NSE:RELIANCE-EQ": true} }
  const { symbols, toggles } = req.body;

  // Unsubscribe old, subscribe new
  const oldSymbols = [...selectedSymbols];
  selectedSymbols  = symbols || [];
  stockToggles     = toggles || {};

  const toRemove = oldSymbols.filter(s => !selectedSymbols.includes(s));
  const toAdd    = selectedSymbols.filter(s => !oldSymbols.includes(s));

  if (toRemove.length) fyersData.unsubscribe(toRemove);
  if (toAdd.length)    fyersData.subscribe(toAdd);

  // Update ORB engine
  selectedSymbols.forEach(s => orbEngine.setStockToggle(s, stockToggles[s] !== false));

  logger.info(`[SERVER] Stocks updated: ${selectedSymbols.join(', ')}`);
  saveState();

  // Auto-fetch ORB from history for each symbol if after 9:20 AM
  const now = new Date();
  const h = now.getHours(), m = now.getMinutes();
  const afterORB = (h > 9) || (h === 9 && m >= 20);
  if (afterORB && fyersAuth.isAuthenticated) {
    selectedSymbols.forEach(async (sym) => {
      try {
        const dayjs = require('dayjs');
        const today = dayjs().format('YYYY-MM-DD');
        const candles = await fyersAuth.getHistory({
          symbol: sym, resolution: '5',
          rangeFrom: today, rangeTo: today, dateFormat: 0
        });
        if (candles?.length > 0) {
          const formatted = candles.map(c => ({
            time: c[0]*1000, open:c[1], high:c[2], low:c[3], close:c[4], volume:c[5]
          }));
          orbEngine.setORBFromHistory(sym, formatted);
          emit('orbLocked', { symbol: sym, ...orbEngine.getORBLevel(sym) });
        }
      } catch(e) {
        logger.warn(`[SERVER] Could not fetch ORB history for ${sym}: ${e.message}`);
      }
    });
  }

  res.json({ success: true, subscribed: selectedSymbols });
});

app.get('/api/stocks/orb', (req, res) => {
  const levels = {};
  selectedSymbols.forEach(s => { levels[s] = orbEngine.getORBLevel(s); });
  res.json({ success: true, levels });
});

app.get('/api/stocks/ticks', (req, res) => {
  res.json({ success: true, ticks: fyersData.getAllTicks() });
});

app.get('/api/stocks/candles/:symbol', (req, res) => {
  const symbol = decodeURIComponent(req.params.symbol);
  const tf     = req.query.tf || '5M';
  const candles = orbEngine.getCandles(symbol, tf);
  res.json({ success: true, symbol, tf, candles });
});

// ── Portfolio & Orders ────────────────────────────────────
app.get('/api/portfolio/positions', async (req, res) => {
  try {
    const positions = await fyersAuth.getPositions();
    res.json({ success: true, positions });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/portfolio/orders', async (req, res) => {
  try {
    const orders = await fyersAuth.getOrders();
    res.json({ success: true, orders });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/portfolio/funds', async (req, res) => {
  try {
    const axios = require('axios');
    // Use direct axios call — more reliable than fyers-api-v3 object
    // Try multiple endpoints
    let r;
    try {
      r = await axios.get('https://api-t1.fyers.in/api/v3/funds', {
        headers: { Authorization: `${fyersAuth.appId}:${fyersAuth.accessToken}` },
        timeout: 10000
      });
    } catch(e) {
      r = await axios.get('https://api-t2.fyers.in/api/v3/funds', {
        headers: { Authorization: `${fyersAuth.appId}:${fyersAuth.accessToken}` },
        timeout: 10000
      });
    }
    const data = r.data;
    const funds = data.fund_limit || [];

    // Extract available balance
    let availableBalance = 0;
    for (const f of funds) {
      const t = (f.title||'').toLowerCase();
      const v = parseFloat(f.equityAmount ?? 0);
      if (v > 0 && (t.includes('available') || t.includes('clear') || t.includes('free'))) {
        availableBalance = v; break;
      }
    }
    // Fallback: find any positive equityAmount
    if (availableBalance === 0) {
      for (const f of funds) {
        const v = parseFloat(f.equityAmount ?? 0);
        if (v > 0) { availableBalance = v; break; }
      }
    }

    logger.info(`[FUNDS] ${funds.length} entries, available: ${availableBalance}`);
    res.json({ success: true, funds, availableBalance, raw: data });
  } catch (err) {
    logger.error('[FUNDS]', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Manual / Test Orders ──────────────────────────────────
app.post('/api/orders/place', async (req, res) => {
  const { symbol, side, qty, orderType, price, productType } = req.body;

  // Try direct axios call first (more reliable than fyers-api-v3 object)
  try {
    if (!fyersAuth.isAuthenticated || !fyersAuth.accessToken) {
      return res.json({ success: false, error: 'Fyers not authenticated' });
    }

    const axios = require('axios');
    const ORDER_TYPE = { MARKET:2, LIMIT:1, STOP_LOSS:4, STOP_LOSS_MARKET:3 };
    const SIDE = { BUY:1, SELL:-1 };

    const payload = {
      symbol,
      qty:         parseInt(qty) || 1,
      type:        ORDER_TYPE[orderType] || 2,
      side:        SIDE[side] || 1,
      productType: productType || process.env.PRODUCT_TYPE || 'INTRADAY',
      limitPrice:  orderType === 'LIMIT' ? (parseFloat(price)||0) : 0,
      stopPrice:   (orderType === 'STOP_LOSS' || orderType === 'STOP_LOSS_MARKET') ? (parseFloat(price)||0) : 0,
      disclosedQty: 0,
      validity:    'DAY',
      offlineOrder: false,
      stopLoss:    0,
      takeProfit:  0
    };

    const headers = { Authorization: `${fyersAuth.appId}:${fyersAuth.accessToken}` };
    const timeout = 10000;

    // Try all known Fyers API v3 order endpoints
    const endpoints = [
      'https://api-t1.fyers.in/api/v3/orders/sync',
      'https://api-t2.fyers.in/api/v3/orders/sync',
      'https://api.fyers.in/api/v3/orders/sync',
      'https://api-t1.fyers.in/api/v3/orders',
    ];

    let data = null;
    let lastError = null;

    for (const url of endpoints) {
      try {
        logger.info(`[ORDER] Trying endpoint: ${url}`);
        const r = await axios.post(url, payload, { headers, timeout });
        data = r.data;
        if (data.s === 'ok' || data.code === 200) {
          logger.info(`[ORDER] ✅ Order placed via ${url}: ${data.id}`);
          return res.json({ success: true, orderId: data.id, order: { ...payload, orderId: data.id, status: 'PENDING' } });
        }
        lastError = data.message || JSON.stringify(data);
        break; // Got response but not ok — don't try other endpoints
      } catch (urlErr) {
        lastError = urlErr.message;
        if (urlErr.response?.status === 404) continue; // Try next endpoint
        break; // Other error — stop trying
      }
    }
    throw new Error(lastError || 'All endpoints failed');
  } catch (err) {
    logger.error('[ORDER] Direct order failed:', err.message);
    // Fallback to orderExecutor
    const result = await orderExecutor.placeOrder({ symbol, side, qty, orderType, price, productType });
    res.json(result);
  }
});

app.post('/api/orders/test', async (req, res) => {
  const { symbol, side, qty, orderType, price } = req.body;
  const result = await orderExecutor.testSignal({ symbol, side, qty, orderType, price });
  emit('testSignalResult', result);
  res.json(result);
});

app.post('/api/orders/cancel/:orderId', async (req, res) => {
  const result = await orderExecutor.cancelOrder(req.params.orderId);
  res.json(result);
});

app.post('/api/orders/squareoff/:symbol', async (req, res) => {
  const symbol = decodeURIComponent(req.params.symbol);
  const { side, qty } = req.body;
  const result = await orderExecutor.exitPosition(symbol, side, qty);
  res.json(result);
});

app.get('/api/orders/history', (req, res) => {
  res.json({ success: true, orders: orderExecutor.getHistory() });
});

// ── Risk & Config ─────────────────────────────────────────
app.get('/api/risk/status', (req, res) => {
  res.json({ success: true, ...riskManager.getStatus() });
});

// GET RR config — used by chart for SL/TGT calculation
app.get('/api/risk/config', (req, res) => {
  const cfg = riskManager.getConfig ? riskManager.getConfig() : null;
  const fallback = {
    capital:50000,leverage:5,riskPct:2,rrRatio:2,maxSLPerDay:3,
    cryptoLeverage:10,cryptoRiskPct:2,cryptoRRRatio:2,cryptoMaxSL:3
  };
  res.json({ success:true, config: cfg || fallback });
});

app.post('/api/risk/config', (req, res) => {
  const cfg = req.body;
  rrConfig = { ...rrConfig, ...cfg };
  riskManager.updateConfig(rrConfig);
  orbEngine.updateConfig(rrConfig);
  emit('configUpdated', rrConfig);
  saveState();
  res.json({ success: true, config: rrConfig });
});

app.post('/api/risk/resume', (req, res) => {
  riskManager.resumeTrading();
  emit('tradingResumed', {});
  res.json({ success: true });
});

// ── Control ───────────────────────────────────────────────
app.post('/api/control/master', (req, res) => {
  const { enabled } = req.body;
  masterEnabled = !!enabled;
  orbEngine.setEnabled(masterEnabled);
  logger.info(`[SERVER] Master trading: ${masterEnabled ? 'ON' : 'OFF'}`);
  emit('masterToggle', { enabled: masterEnabled });
  saveState();
  res.json({ success: true, enabled: masterEnabled });
});

app.post('/api/control/stock-toggle', (req, res) => {
  const { symbol, enabled } = req.body;
  stockToggles[symbol] = !!enabled;
  orbEngine.setStockToggle(symbol, !!enabled);
  emit('stockToggle', { symbol, enabled });
  res.json({ success: true, symbol, enabled });
});

// ── Alerts ────────────────────────────────────────────────
app.get('/api/alerts', (req, res) => {
  res.json({ success: true, alerts: alertLog.slice(-100) });
});

// ── Serve React Frontend (Production) ────────────────────
if (process.env.NODE_ENV === 'production') {
  const path2 = require('path');
  app.use(express.static(path2.join(__dirname, 'public')));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) return next();
    res.sendFile(path2.join(__dirname, 'public', 'index.html'));
  });
}

// ─────────────────────────────────────────────────────────
// DELTA EXCHANGE ROUTES
// ─────────────────────────────────────────────────────────

// Connect Delta Exchange API
app.post('/api/delta/connect', async (req, res) => {
  const { id, name, apiKey, apiSecret, region } = req.body;
  if (!id || !apiKey || !apiSecret) {
    return res.status(400).json({ success: false, error: 'id, apiKey and apiSecret required' });
  }
  try {
    deltaAuth.addApi({ id, name: name||"Delta Exchange", apiKey, apiSecret, region: region||"india" });
    const result = await deltaAuth.connect(id);

    const balances = result.balance || [];
    let availableBalance = 0;
    for (const b of balances) {
      const asset = (b.asset_symbol || b.currency || '').toUpperCase();
      if (asset === 'USDT' || asset === 'USD' || asset === 'INR') {
        availableBalance = parseFloat(b.available_balance || b.balance || 0);
        break;
      }
    }
    if (availableBalance === 0 && balances.length > 0) {
      availableBalance = parseFloat(balances[0].available_balance || balances[0].balance || 0);
    }

    logger.info(`[DELTA] Connected ${name} — Balance: ${availableBalance}`);
    res.json({ success: true, connected: true, balance: balances, availableBalance });
  } catch (err) {
    // Extract full error details
    const errDetails = {
      message: err.message,
      status:  err.response?.status,
      data:    err.response?.data,
      raw:     String(err)
    };
    logger.error('[DELTA] Connect error:', JSON.stringify(errDetails));
    const errMsg = err.response?.data?.error?.message
      || err.response?.data?.message
      || err.response?.data?.error
      || err.message
      || 'Unknown error';
    res.json({ success: false, error: String(errMsg), details: errDetails, connected: false });
  }
});

// Get Delta balance
app.get('/api/delta/balance/:id', async (req, res) => {
  try {
    const balance = await deltaAuth.getBalance(req.params.id);
    let availableBalance = 0;
    for (const b of balance) {
      const asset = (b.asset_symbol || b.currency || '').toUpperCase();
      if (asset === 'USDT' || asset === 'USD') {
        availableBalance = parseFloat(b.available_balance || b.balance || 0);
        break;
      }
    }
    res.json({ success: true, balance, availableBalance });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// Get Delta positions
app.get('/api/delta/positions/:id', async (req, res) => {
  try {
    const positions = await deltaAuth.getPositions(req.params.id);
    res.json({ success: true, positions });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// Get Delta status for all APIs
app.get('/api/delta/status', (req, res) => {
  res.json({ success: true, apis: deltaAuth.getStatus() });
});

// Get Delta products list
app.get('/api/delta/products/:apiId', async (req, res) => {
  try {
    const axios = require('axios');
    const a = deltaAuth.getApi(req.params.apiId);
    const region = req.query.region || 'india';
    const baseUrl = a?.baseUrl || (region==='global'?'https://api.delta.exchange':'https://api.india.delta.exchange');
    const r = await axios.get(`${baseUrl}/v2/products`, { timeout: 10000 });
    const products = (r.data.result || [])
      .filter(p => p.trading_status === 'operational' && p.product_type === 'perpetual_futures')
      .map(p => ({ id: p.id, symbol: p.symbol, description: p.description }));
    res.json({ success: true, products });
  } catch(err) {
    res.json({ success: false, error: err.message });
  }
});

// Place Delta Exchange order
app.post('/api/delta/order', async (req, res) => {
  const { apiId, symbol, side, size, orderType, limitPrice, apiKey, apiSecret, region } = req.body;
  if (!apiId || !symbol || !side || !size) {
    return res.status(400).json({ success: false, error: 'apiId, symbol, side, size required' });
  }
  try {
    // Re-register API if credentials provided (handles server restart)
    if (apiKey && apiSecret) {
      deltaAuth.addApi({ id: String(apiId), name: 'Delta', apiKey, apiSecret, region: region||'india' });
    }
    const axios = require('axios');
    const a = deltaAuth.getApi(String(apiId));
    if (!a) return res.json({ success: false, error: 'API not found — please reconnect in API Credentials' });
    
    const prodRes = await axios.get(`${a.baseUrl}/v2/products`, { timeout: 10000 });
    const product = (prodRes.data.result || []).find(p => p.symbol === symbol);
    if (!product) return res.json({ success: false, error: `Product ${symbol} not found on Delta Exchange` });
    
    const result = await deltaAuth.placeOrder(apiId, {
      productId: product.id, side, size: parseInt(size),
      orderType: orderType || 'market_order', limitPrice
    });
    logger.info(`[DELTA] Order placed: ${JSON.stringify(result)}`);
    res.json(result);
  } catch (err) {
    logger.error('[DELTA] Order error:', err.message);
    const msg = err.response?.data?.error?.message || err.response?.data?.message || err.message;
    res.json({ success: false, error: String(msg) });
  }
});

// ── Check outbound IP (for Delta whitelist) ──────────────
app.get('/api/myip', async (req, res) => {
  try {
    const axios = require('axios');
    const r = await axios.get('https://api.ipify.org?format=json', { timeout: 5000 });
    res.json({ success: true, ip: r.data.ip });
  } catch(e) {
    res.json({ success: false, error: e.message });
  }
});

// ─────────────────────────────────────────────────────────
// CHART ALERT WEBHOOK
// Receives alerts from standalone chart → places broker order
// ─────────────────────────────────────────────────────────
app.post('/api/alerts/webhook', async (req, res) => {
  const { symbol, side, price, type, tf, note, qty, broker, source } = req.body;

  if (!symbol || !side) {
    return res.status(400).json({ success:false, error:'symbol and side required' });
  }

  const alertEntry = {
    id:       Date.now(),
    symbol,
    side:     side.toUpperCase(),
    price:    parseFloat(price) || 0,
    type:     type || side,
    tf:       tf || '5m',
    note:     note || '',
    source:   source || 'chart',
    broker:   broker || 'auto',
    ts:       new Date().toISOString(),
    status:   'RECEIVED'
  };

  logger.info(`[WEBHOOK] Alert received: ${side} ${symbol} @ ${price} from ${source}`);
  _addAlert({ ...alertEntry, msg: `[CHART] ${side} ${symbol} @ ${price} | ${type} | ${tf}` });
  emit('chartAlert', alertEntry);

  // ── Determine order params ──────────────────────────────
  const orderSide = side.toUpperCase() === 'BUY' ||
    type === 'buy' || type === 'buy_tgt' ? 'BUY' : 'SELL';

  // ── Route to correct broker ───────────────────────────
  const isCrypto = !symbol.endsWith('.NS') && !symbol.endsWith('.BSE') &&
                   symbol.includes('USD') || symbol.includes('BTC');

  try {
    // ── FYERS (Indian stocks) ─────────────────────────────
    if (!isCrypto && fyersAuth.isAuthenticated) {
      if (!masterEnabled) {
        alertEntry.status = 'SKIPPED';
        return res.json({ success:true, status:'SKIPPED', reason:'Master toggle is OFF', alert:alertEntry });
      }

      // Convert Yahoo symbol to Fyers format
      const fyersSym = symbol.replace('.NS','-EQ').replace('NSE:','');
      const fyersSymFull = fyersSym.startsWith('NSE:') ? fyersSym : `NSE:${fyersSym}`;

      const orderQty = parseInt(qty) || 1;
      const result = await orderExecutor.placeOrder({
        symbol:      fyersSymFull,
        side:        orderSide,
        qty:         orderQty,
        orderType:   'MARKET',
        productType: process.env.PRODUCT_TYPE || 'INTRADAY'
      });

      alertEntry.status = result.success ? 'EXECUTED' : 'FAILED';
      alertEntry.orderId = result.orderId;
      alertEntry.error   = result.error;

      _addAlert({
        type:   orderSide,
        symbol: fyersSymFull,
        msg:    result.success
          ? `✅ [CHART→FYERS] ${orderSide} ${orderQty} ${fyersSymFull} @ MARKET | OrderID: ${result.orderId}`
          : `❌ [CHART→FYERS] FAILED: ${result.error}`,
        status: result.success ? 'EXECUTED' : 'FAILED',
        ts:     new Date().toISOString()
      });

      logger.info(`[WEBHOOK] Fyers order: ${JSON.stringify(result)}`);
      return res.json({ success:true, broker:'fyers', result, alert:alertEntry });
    }

    // ── DELTA EXCHANGE (Crypto) ───────────────────────────
    if (isCrypto) {
      // Find first connected Delta API
      const deltaApis = deltaAuth.getStatus().filter(a => a.connected);
      if (!deltaApis.length) {
        return res.json({ success:false, error:'No Delta Exchange API connected', alert:alertEntry });
      }

      const deltaApi  = deltaApis[0];
      const cryptoSym = symbol.replace('USDT','USD'); // Delta uses BTCUSD not BTCUSDT
      const orderQty  = parseInt(qty) || 1;

      // Look up product ID
      const axios = require('axios');
      const a = deltaAuth.getApi(deltaApi.id);
      const prodRes = await axios.get(`${a.baseUrl}/v2/products`, { timeout:10000 });
      const product = (prodRes.data.result||[]).find(p => p.symbol === cryptoSym || p.symbol === symbol);

      if (!product) {
        return res.json({ success:false, error:`Product ${cryptoSym} not found on Delta`, alert:alertEntry });
      }

      const result = await deltaAuth.placeOrder(deltaApi.id, {
        productId: product.id,
        side:      orderSide,
        size:      orderQty,
        orderType: 'market_order'
      });

      alertEntry.status  = result.success ? 'EXECUTED' : 'FAILED';
      alertEntry.orderId = result.orderId;

      _addAlert({
        type:   orderSide,
        symbol: cryptoSym,
        msg:    result.success
          ? `✅ [CHART→DELTA] ${orderSide} ${orderQty} ${cryptoSym} | OrderID: ${result.orderId}`
          : `❌ [CHART→DELTA] FAILED: ${result.error}`,
        status: result.success ? 'EXECUTED' : 'FAILED',
        ts:     new Date().toISOString()
      });

      logger.info(`[WEBHOOK] Delta order: ${JSON.stringify(result)}`);
      return res.json({ success:true, broker:'delta', result, alert:alertEntry });
    }

    // No broker available
    alertEntry.status = 'NO_BROKER';
    return res.json({ success:false, error:'No broker connected. Login to Fyers or connect Delta Exchange.', alert:alertEntry });

  } catch(err) {
    logger.error('[WEBHOOK] Order error:', err.message);
    alertEntry.status = 'ERROR';
    alertEntry.error  = err.message;
    return res.json({ success:false, error:err.message, alert:alertEntry });
  }
});

// ── Get all chart-fired alerts ────────────────────────────
app.get('/api/alerts/history', (req, res) => {
  const chartAlerts = alertLog.filter(a => a.source === 'chart' || a.msg?.includes('[CHART]'));
  res.json({ success:true, alerts: chartAlerts.slice(-100) });
});

// ─────────────────────────────────────────────────────────
// CHART DATA PROXY — serves Indian stock candles to chart.html
// Runs server-side so no CORS issues with Yahoo Finance
// ─────────────────────────────────────────────────────────
app.get('/api/chart/history', async (req, res) => {
  // Allow chart.html from any origin
  res.header('Access-Control-Allow-Origin', '*');

  const { symbol, tf } = req.query;
  if (!symbol) return res.status(400).json({ error: 'symbol required' });

  const isIndian = symbol.endsWith('.NS') || symbol.endsWith('.BSE') || symbol.includes(':');
  
  if (!isIndian) return res.json({ error: 'use Binance for crypto' });

  // Map timeframe to Yahoo interval and range
  const IV_MAP = { '1m':'1m','3m':'2m','5m':'5m','10m':'5m','15m':'15m','30m':'30m','1h':'60m','4h':'60m','1d':'1d' };
  const RG_MAP = { '1m':'1d','3m':'2d','5m':'5d','10m':'5d','15m':'5d','30m':'30d','1h':'60d','4h':'60d','1d':'1y' };
  const interval = IV_MAP[tf] || '5m';
  const range    = RG_MAP[tf] || '5d';

  try {
    const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}&includePrePost=false`;
    
    const https = require('https');
    const data = await new Promise((resolve, reject) => {
      const options = {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122',
          'Accept': 'application/json, */*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Origin': 'https://finance.yahoo.com',
          'Referer': 'https://finance.yahoo.com/',
        }
      };
      https.get(yahooUrl, options, (r) => {
        let body = '';
        r.on('data', chunk => body += chunk);
        r.on('end', () => resolve(body));
      }).on('error', reject);
    });

    const parsed = JSON.parse(data);
    const result = parsed.chart?.result?.[0];
    if (!result) return res.json({ success: false, candles: [], error: 'No data' });

    const ts = result.timestamps || result.timestamp || [];
    const q  = result.indicators?.quote?.[0] || {};

    const candles = ts.map((t, i) => ({
      time:   t,
      open:   q.open?.[i],
      high:   q.high?.[i],
      low:    q.low?.[i],
      close:  q.close?.[i],
      volume: q.volume?.[i] || 0
    })).filter(c => c.open && c.close && !isNaN(c.close));

    logger.info(`[CHART] ${symbol} ${tf} — ${candles.length} candles`);
    res.json({ success: true, symbol, tf, candles });

  } catch (err) {
    logger.error('[CHART] History error:', err.message);
    res.json({ success: false, candles: [], error: err.message });
  }
});

// ── Force reconnect feed ─────────────────────────────────
app.get('/api/feed/reconnect', (req, res) => {
  try {
    if (fyersAuth.isAuthenticated && fyersAuth.accessToken) {
      fyersData.disconnect();
      setTimeout(() => {
        fyersData.init(process.env.FYERS_APP_ID, fyersAuth.accessToken);
        fyersData.connect();
        if (selectedSymbols.length > 0) {
          setTimeout(() => fyersData.subscribe(selectedSymbols), 2000);
        }
      }, 1000);
      logger.info('[SERVER] Feed reconnect triggered via API');
      res.json({ success: true, message: 'Feed reconnecting...', symbols: selectedSymbols });
    } else {
      res.json({ success: false, message: 'Not authenticated' });
    }
  } catch(err) {
    res.json({ success: false, error: err.message });
  }
});

// ── Health ────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status:          'ok',
    uptime:          process.uptime(),
    dataFeed:        fyersData.isConnected,
    auth:            fyersAuth.isAuthenticated,
    masterEnabled,
    subscribedStocks: selectedSymbols.length,
    activeSignals:   Object.keys(orbEngine.getActiveSignals()).length,
    time:            new Date().toISOString()
  });
});

// ─────────────────────────────────────────────────────────
// SOCKET.IO CONNECTION HANDLER
// ─────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  logger.info(`[SOCKET] Client connected: ${socket.id}`);

  // Send current state to newly connected client
  socket.emit('initState', {
    masterEnabled,
    selectedSymbols,
    stockToggles,
    rrConfig,
    authStatus:    fyersAuth.getStatus(),
    riskStatus:    riskManager.getStatus(),
    orbStats:      orbEngine.getStats(),
    ticks:         fyersData.getAllTicks(),
    alerts:        alertLog.slice(-50)
  });

  socket.on('disconnect', () => {
    logger.info(`[SOCKET] Client disconnected: ${socket.id}`);
  });
});

// ─────────────────────────────────────────────────────────
// WIRE: DATA FEED → ORB ENGINE → ORDER EXECUTOR
// ─────────────────────────────────────────────────────────

// Every tick from Fyers → ORB engine + broadcast to clients
fyersData.on('tick', ({ symbol, tick }) => {
  orbEngine.onTick(symbol, tick);

  // Broadcast live tick to all connected clients (throttled)
  io.volatile.emit('tick', { symbol, tick });
});

fyersData.on('connected', () => {
  logger.info('[DATA] Feed connected → subscribing to selected symbols');
  if (selectedSymbols.length > 0) fyersData.subscribe(selectedSymbols);
  emit('feedConnected', {});
});

fyersData.on('disconnected', () => {
  emit('feedDisconnected', {});
});

// ── ORB Engine Events ─────────────────────────────────────
orbEngine.on('orbLocked', ({ symbol, high, low }) => {
  const alert = {
    type: 'ORB_LOCKED', symbol, high, low,
    msg:  `ORB locked: H=${high.toFixed(2)} L=${low.toFixed(2)}`,
    ts:   new Date().toISOString()
  };
  _addAlert(alert);
  emit('orbLocked', alert);
});

orbEngine.on('signal', async (signal) => {
  const alert = {
    type:   signal.direction,
    symbol: signal.symbol,
    price:  signal.entry,
    sl:     signal.sl,
    target: signal.target,
    qty:    signal.qty,
    msg:    `ORB ${signal.direction} signal → Entry:${signal.entry} SL:${signal.sl} Tgt:${signal.target} Qty:${signal.qty} SLpts:${signal.slPoints}`,
    ts:     new Date().toISOString(),
    status: 'PENDING'
  };
  _addAlert(alert);
  emit('signal', alert);

  // ── Execute trade if master enabled and risk allows ──
  if (!masterEnabled) {
    logger.info(`[SERVER] Signal for ${signal.symbol} — master OFF, skipping.`);
    _updateAlertStatus(signal.symbol, 'SKIPPED_MASTER_OFF');
    return;
  }

  const riskCheck = riskManager.canTrade(signal.symbol);
  if (!riskCheck.allowed) {
    logger.warn(`[SERVER] Signal for ${signal.symbol} blocked: ${riskCheck.errors.join(', ')}`);
    _updateAlertStatus(signal.symbol, 'BLOCKED_RISK');
    emit('signalBlocked', { symbol: signal.symbol, reasons: riskCheck.errors });
    return;
  }

  // Place the order
  const result = await orderExecutor.placeORBTrade(signal);
  if (result.entry?.success) {
    orbEngine.registerSignal(signal);
    _updateAlertStatus(signal.symbol, 'EXECUTED');
    // Add execution details to alert
    _addAlert({
      type:   'ORDER_PLACED',
      symbol: signal.symbol,
      msg:    `✅ Order placed → ID:${result.entry.orderId} | ${signal.direction} ${signal.qty} @ ₹${signal.entry} | SL:₹${signal.sl} Tgt:₹${signal.target}`,
      ts:     new Date().toISOString(),
      status: 'EXECUTED'
    });
    emit('orderExecuted', { signal, result });
  } else {
    _updateAlertStatus(signal.symbol, 'ORDER_FAILED');
    // Add failure details
    _addAlert({
      type:   'ORDER_FAILED',
      symbol: signal.symbol,
      msg:    `❌ Order FAILED → ${signal.direction} ${signal.qty} shares @ ₹${signal.entry} | Error: ${result.entry?.error}`,
      ts:     new Date().toISOString(),
      status: 'FAILED'
    });
    emit('orderFailed', { symbol: signal.symbol, error: result.entry?.error });
  }
});

orbEngine.on('slTrailed', ({ symbol, newSl, ltp }) => {
  const sig = orbEngine.getActiveSignals()[symbol];
  if (sig) {
    // Modify the SL order at Fyers
    const slOrderId = orderExecutor.slOrderMap[Object.keys(orderExecutor.slOrderMap).find(k => true)];
    if (slOrderId) orderExecutor.modifyStopLoss(slOrderId, newSl);
  }
  emit('slTrailed', { symbol, newSl, ltp });
  _addAlert({ type: 'SL_TRAILED', symbol, msg: `SL trailed to entry (${newSl})`, ts: new Date().toISOString() });
});

orbEngine.on('exit', (exitData) => {
  riskManager.recordTrade({
    symbol: exitData.symbol,
    pnl:    exitData.pnl,
    reason: exitData.reason
  });
  const alert = {
    type:   exitData.reason,
    symbol: exitData.symbol,
    price:  exitData.exitPrice,
    pnl:    exitData.pnl,
    msg:    `${exitData.reason}: ${exitData.symbol} PnL ₹${exitData.pnl.toFixed(2)}`,
    ts:     new Date().toISOString()
  };
  _addAlert(alert);
  emit('tradeExit', { ...exitData, alert });
  emit('pnlUpdate', orbEngine.getStats());
});

// ── Risk events ───────────────────────────────────────────
riskManager.on('tradingHalted', ({ reason }) => {
  masterEnabled = false;
  orbEngine.setEnabled(false);
  emit('tradingHalted', { reason });
  emit('systemAlert', { msg: `🛑 Trading halted: ${reason}`, type: 'ERROR' });
});

// ── Order executor events ─────────────────────────────────
orderExecutor.on('orderPlaced', (order) => emit('orderPlaced', order));
orderExecutor.on('orderUpdate',  (order) => emit('orderUpdate',  order));
orderExecutor.on('testSignal',   (order) => emit('testSignalResult', order));

// ─────────────────────────────────────────────────────────
// SCHEDULER
// ─────────────────────────────────────────────────────────
scheduler.init({
  orb:      orbEngine,
  executor: orderExecutor,
  risk:     riskManager,
  feed:     fyersData,
  emitFn:   emit
});

// ─────────────────────────────────────────────────────────
// AUTO RECONNECT FEED if it drops (check every 2 minutes)
// ─────────────────────────────────────────────────────────
setInterval(() => {
  if (fyersAuth.isAuthenticated && !fyersData.isConnected) {
    logger.warn('[SERVER] Feed disconnected — auto reconnecting...');
    fyersData.init(process.env.FYERS_APP_ID, fyersAuth.accessToken);
    fyersData.connect();
    setTimeout(() => {
      if (selectedSymbols.length > 0) fyersData.subscribe(selectedSymbols);
    }, 3000);
  }
}, 2 * 60 * 1000);

// ─────────────────────────────────────────────────────────
// LIVE P&L BROADCAST (every 5 seconds)
// ─────────────────────────────────────────────────────────
setInterval(() => {
  if (io.engine.clientsCount === 0) return;
  const stats = orbEngine.getStats();
  const ticks = fyersData.getAllTicks();

  // Compute live unrealised P&L for open signals
  const livePositions = {};
  Object.entries(orbEngine.getActiveSignals()).forEach(([symbol, sig]) => {
    const tick = ticks[symbol];
    if (!tick) return;
    const ltp = tick.ltp;
    const unrealised = sig.direction === 'BUY'
      ? (ltp - sig.entry) * sig.qty
      : (sig.entry - ltp) * sig.qty;
    livePositions[symbol] = { ...sig, ltp, unrealised: +unrealised.toFixed(2) };
  });

  emit('pnlUpdate', {
    stats,
    livePositions,
    riskStatus: riskManager.getStatus().daily
  });
}, 5000);

// ─────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────
function _addAlert(alert) {
  alertLog.push(alert);
  if (alertLog.length > 500) alertLog.shift();
}

function _updateAlertStatus(symbol, status) {
  for (let i = alertLog.length - 1; i >= 0; i--) {
    if (alertLog[i].symbol === symbol && alertLog[i].status === 'PENDING') {
      alertLog[i].status = status;
      break;
    }
  }
}

// ─────────────────────────────────────────────────────────
// START SERVER
// ─────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  logger.info(`
  ╔══════════════════════════════════════════╗
  ║   ALGO_BOT_ORB_10_STOCK — Server Ready  ║
  ║   http://localhost:${PORT}                  ║
  ║   Mode: ${(process.env.NODE_ENV || 'development').padEnd(32)}║
  ╚══════════════════════════════════════════╝
  `);
});

module.exports = { app, server, io };

// INJECTED ROUTES — History, Instruments, Live Price
// ─────────────────────────────────────────────────────────

// ── Fyers Historical Candles (for chart) ─────────────────
app.get('/api/stocks/history', async (req, res) => {
  try {
    const { symbol, resolution = '5', days = 5 } = req.query;
    if (!symbol) return res.status(400).json({ error: 'symbol required' });
    if (!fyersAuth.isAuthenticated) return res.status(401).json({ error: 'Not authenticated' });

    const dayjs = require('dayjs');
    const now   = dayjs();
    // Use date string format YYYY-MM-DD for Fyers v3
    const rangeTo   = now.format('YYYY-MM-DD');
    const rangeFrom = now.subtract(parseInt(days), 'day').format('YYYY-MM-DD');

    const candles = await fyersAuth.getHistory({
      symbol,
      resolution,
      rangeFrom,
      rangeTo,
      dateFormat: 1   // 1 = epoch, 0 = date string
    });

    if (!candles || candles.length === 0) {
      return res.json({ success: true, symbol, resolution, candles: [], message: 'No data returned' });
    }

    // candles = [[timestamp, open, high, low, close, volume], ...]
    const formatted = candles.map(c => ({
      time:   c[0] * 1000,
      open:   c[1],
      high:   c[2],
      low:    c[3],
      close:  c[4],
      volume: c[5]
    }));

    res.json({ success: true, symbol, resolution, candles: formatted, count: formatted.length });
  } catch (err) {
    logger.error('[HISTORY]', err.message);
    res.json({ success: false, error: err.message, candles: [] });
  }
});

// ── Fyers Instruments (all NSE stocks) ───────────────────
// Cache instruments in memory — reload once per day
let _instrumentsCache = null;
let _instrumentsTime  = 0;

app.get('/api/instruments', async (req, res) => {
  try {
    const axios = require('axios');
    const now = Date.now();

    // Return cache if < 6 hours old
    if (_instrumentsCache && (now - _instrumentsTime) < 6*60*60*1000) {
      return res.json({ success: true, count: _instrumentsCache.length, stocks: _instrumentsCache, cached: true });
    }

    // Fyers public instruments CSV
    const url = 'https://public.fyers.in/sym_details/NSE_CM.csv';
    const response = await axios.get(url, { timeout: 20000 });
    const lines  = response.data.split('\n').filter(Boolean);
    const stocks = [];
    const seen   = new Set();

    lines.forEach((line, idx) => {
      if (idx === 0) return; // skip header
      const cols = line.split(',');
      if (cols.length < 11) return;

      // Fyers NSE_CM.csv format (may vary):
      // Col 0: Fytoken, Col 1: SymbolDetails, Col 2: ExSymbol,
      // Col 3: Exchange, Col 4: Segment, Col 5: LotSize,
      // Col 6: TickSize, Col 7: ISIN, Col 8: TradingSession,
      // Col 9: LastUpdateDate, Col 10: ExpiryDate,
      // Col 11: SymbolTicker (NSE:RELIANCE-EQ), Col 12: Exchange, Col 13: Segment, Col 14: Scrip

      // Try col 11 first (most common position for full symbol)
      let ticker = (cols[11]||'').trim().replace(/"/g,'');
      let name   = (cols[14]||cols[2]||cols[1]||'').trim().replace(/"/g,'');

      // Fallback: search all cols for NSE:*-EQ pattern
      if (!ticker.includes('NSE:') || !ticker.includes('-EQ')) {
        for (const col of cols) {
          const t = col.trim().replace(/"/g,'');
          if (t.startsWith('NSE:') && t.endsWith('-EQ')) { ticker = t; break; }
        }
      }

      if (!ticker || !ticker.startsWith('NSE:') || !ticker.endsWith('-EQ')) return;
      if (seen.has(ticker)) return;
      seen.add(ticker);

      // Clean name
      if (!name || name.length < 2) name = ticker.replace('NSE:','').replace('-EQ','');

      stocks.push({ symbol: ticker, name: name.slice(0,40), token: (cols[0]||'').trim() });
    });

    if (stocks.length > 0) {
      _instrumentsCache = stocks;
      _instrumentsTime  = now;
      logger.info('[INSTRUMENTS] Loaded ' + stocks.length + ' NSE stocks');
      return res.json({ success: true, count: stocks.length, stocks });
    }

    // If parsing failed, return basic fallback list
    throw new Error('No stocks parsed from CSV');
  } catch (err) {
    logger.error('[INSTRUMENTS]', err.message);
    // Return fallback list
    const fallback = [
      {symbol:'NSE:RELIANCE-EQ',name:'Reliance Industries'},{symbol:'NSE:TCS-EQ',name:'TCS'},
      {symbol:'NSE:HDFCBANK-EQ',name:'HDFC Bank'},{symbol:'NSE:INFY-EQ',name:'Infosys'},
      {symbol:'NSE:ICICIBANK-EQ',name:'ICICI Bank'},{symbol:'NSE:SBIN-EQ',name:'SBI'},
      {symbol:'NSE:BHARTIARTL-EQ',name:'Airtel'},{symbol:'NSE:WIPRO-EQ',name:'Wipro'},
      {symbol:'NSE:BAJFINANCE-EQ',name:'Bajaj Finance'},{symbol:'NSE:LT-EQ',name:'L&T'},
      {symbol:'NSE:AXISBANK-EQ',name:'Axis Bank'},{symbol:'NSE:TATAMOTORS-EQ',name:'Tata Motors'},
      {symbol:'NSE:MARUTI-EQ',name:'Maruti Suzuki'},{symbol:'NSE:SUNPHARMA-EQ',name:'Sun Pharma'},
      {symbol:'NSE:TITAN-EQ',name:'Titan'},{symbol:'NSE:NTPC-EQ',name:'NTPC'},
      {symbol:'NSE:ONGC-EQ',name:'ONGC'},{symbol:'NSE:ITC-EQ',name:'ITC'},
      {symbol:'NSE:HCLTECH-EQ',name:'HCL Tech'},{symbol:'NSE:KOTAKBANK-EQ',name:'Kotak Bank'},
      {symbol:'NSE:ADANIPORTS-EQ',name:'Adani Ports'},{symbol:'NSE:ZOMATO-EQ',name:'Zomato'},
      {symbol:'NSE:TATASTEEL-EQ',name:'Tata Steel'},{symbol:'NSE:DLF-EQ',name:'DLF'},
      {symbol:'NSE:IRCTC-EQ',name:'IRCTC'},{symbol:'NSE:HAL-EQ',name:'HAL'},
      {symbol:'NSE:BEL-EQ',name:'BEL'},{symbol:'NSE:TATAPOWER-EQ',name:'Tata Power'},
      {symbol:'NSE:JSWSTEEL-EQ',name:'JSW Steel'},{symbol:'NSE:HINDALCO-EQ',name:'Hindalco'},
      {symbol:'NSE:VEDL-EQ',name:'Vedanta'},{symbol:'NSE:COALINDIA-EQ',name:'Coal India'},
      {symbol:'NSE:GAIL-EQ',name:'GAIL'},{symbol:'NSE:IOC-EQ',name:'IOC'},
      {symbol:'NSE:BPCL-EQ',name:'BPCL'},{symbol:'NSE:DRREDDY-EQ',name:"Dr Reddy's"},
      {symbol:'NSE:CIPLA-EQ',name:'Cipla'},{symbol:'NSE:LUPIN-EQ',name:'Lupin'},
      {symbol:'NSE:APOLLOHOSP-EQ',name:'Apollo Hospitals'},{symbol:'NSE:DMART-EQ',name:'DMart'},
      {symbol:'NSE:HINDUNILVR-EQ',name:'HUL'},{symbol:'NSE:NESTLEIND-EQ',name:'Nestle'},
      {symbol:'NSE:TECHM-EQ',name:'Tech Mahindra'},{symbol:'NSE:POWERGRID-EQ',name:'Power Grid'},
      {symbol:'NSE:TRENT-EQ',name:'Trent'},{symbol:'NSE:GODREJCP-EQ',name:'Godrej Consumer'},
      {symbol:'NSE:DABUR-EQ',name:'Dabur'},{symbol:'NSE:SAIL-EQ',name:'SAIL'},
      {symbol:'NSE:PNB-EQ',name:'Punjab National Bank'},{symbol:'NSE:BANKBARODA-EQ',name:'Bank of Baroda'},
    ];
    res.json({ success: true, count: fallback.length, stocks: fallback, fallback: true });
  }
});

// ── Live Quote (single symbol) ────────────────────────────
app.get('/api/stocks/quote/:symbol', async (req, res) => {
  try {
    const symbol = decodeURIComponent(req.params.symbol);
    // First check last tick from WebSocket
    const tick = fyersData.getLastTick(symbol);
    if (tick) return res.json({ success: true, source: 'websocket', quote: tick });
    // Fallback: REST quote
    if (!fyersAuth.isAuthenticated) return res.json({ success: false, error: 'Not authenticated' });
    const quotes = await fyersAuth.getQuotes([symbol]);
    const q = quotes[0]?.v || {};
    res.json({
      success: true,
      source:  'rest',
      quote: {
        symbol,
        ltp:    q.lp  || 0,
        open:   q.o   || 0,
        high:   q.h   || 0,
        low:    q.l   || 0,
        close:  q.c   || 0,
        chg:    q.ch  || 0,
        chgPct: q.chp || 0,
        volume: q.v   || 0
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

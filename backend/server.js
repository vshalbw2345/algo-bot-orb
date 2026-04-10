// ─────────────────────────────────────────────────────────
// server.js — ALGO_BOT_ORB Main Server
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
  cors: { origin: '*', methods: ['GET', 'POST'], credentials: false },
  transports: ['websocket', 'polling']
});

// ── Middleware ────────────────────────────────────────────
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: '*', credentials: false }));
app.use(express.json());
app.use(morgan('tiny'));

const limiter = rateLimit({
  windowMs: 60000, max: 200,
  validate: { xForwardedForHeader: false }
});
app.use('/api/', limiter);

// ── Persistent State File ────────────────────────────────
const STATE_FILE = path.join(__dirname, 'state.json');

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
      logger.info('[STATE] Loaded: ' + (data.selectedSymbols||[]).length + ' stocks');
      return data;
    }
  } catch(e) { logger.warn('[STATE] Could not load:', e.message); }
  return {};
}

function saveState() {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify({
      selectedSymbols, stockToggles, rrConfig, masterEnabled
    }, null, 2));
  } catch(e) { logger.warn('[STATE] Could not save:', e.message); }
}

// ── State ─────────────────────────────────────────────────
const savedState    = loadState();
let selectedSymbols = savedState.selectedSymbols || [];
let masterEnabled   = savedState.masterEnabled   || false;
let stockToggles    = savedState.stockToggles    || {};
let rrConfig        = savedState.rrConfig        || {
  capital: 50000, leverage: 5, riskPct: 2, rrRatio: 2, maxSLPerDay: 3
};
let alertLog = [];

logger.info('[STATE] Starting with ' + selectedSymbols.length + ' stocks: ' + selectedSymbols.join(', '));

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
    await fyersAuth.validateAuthCode(authCode);
    fyersData.init(process.env.FYERS_APP_ID, fyersAuth.accessToken);
    fyersData.connect();
    setTimeout(() => {
      if (selectedSymbols.length > 0) {
        fyersData.subscribe(selectedSymbols);
        logger.info('[SERVER] Auto-subscribed ' + selectedSymbols.length + ' stocks');
      }
    }, 3000);
    emit('authSuccess', { profile: fyersAuth.profile });
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}?auth=success`);
  } catch (err) {
    logger.error('[SERVER] Auth callback error:', err.message);
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}?auth=failed&reason=${encodeURIComponent(err.message)}`);
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

// ── Stocks ────────────────────────────────────────────────
app.post('/api/stocks/select', (req, res) => {
  const { symbols, toggles } = req.body;
  const oldSymbols = [...selectedSymbols];
  selectedSymbols  = symbols || [];
  stockToggles     = toggles || {};

  const toRemove = oldSymbols.filter(s => !selectedSymbols.includes(s));
  const toAdd    = selectedSymbols.filter(s => !oldSymbols.includes(s));

  if (toRemove.length) fyersData.unsubscribe(toRemove);
  if (toAdd.length)    fyersData.subscribe(toAdd);

  selectedSymbols.forEach(s => orbEngine.setStockToggle(s, stockToggles[s] !== false));
  logger.info(`[SERVER] Stocks updated: ${selectedSymbols.join(', ')}`);
  saveState();

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
        logger.warn(`[SERVER] ORB history fetch failed for ${sym}: ${e.message}`);
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

app.get('/api/stocks/selected', (req, res) => {
  res.json({ success: true, symbols: selectedSymbols, toggles: stockToggles });
});

// ── Master Switch ─────────────────────────────────────────
app.post('/api/master', (req, res) => {
  const { enabled } = req.body;
  masterEnabled = !!enabled;
  saveState();
  logger.info(`[SERVER] Master switch: ${masterEnabled ? 'ON' : 'OFF'}`);
  emit('masterToggle', { enabled: masterEnabled });
  res.json({ success: true, enabled: masterEnabled });
});

app.get('/api/master', (req, res) => {
  res.json({ success: true, enabled: masterEnabled });
});

// ── RR Config ─────────────────────────────────────────────
app.post('/api/config/rr', (req, res) => {
  rrConfig = { ...rrConfig, ...req.body };
  saveState();
  riskManager.setConfig(rrConfig);
  res.json({ success: true, rrConfig });
});

app.get('/api/config/rr', (req, res) => {
  res.json({ success: true, rrConfig });
});

// ── Risk Manager ──────────────────────────────────────────
app.get('/api/risk/status', (req, res) => {
  res.json({ success: true, ...riskManager.getStatus() });
});

app.post('/api/risk/reset', (req, res) => {
  riskManager.resetDay();
  res.json({ success: true, message: 'Risk reset for the day' });
});

// ── Orders ────────────────────────────────────────────────
app.get('/api/orders', (req, res) => {
  res.json({ success: true, orders: orderExecutor.getHistory() });
});

app.post('/api/orders/exit', async (req, res) => {
  const { symbol, side, qty } = req.body;
  if (!symbol || !side || !qty) return res.status(400).json({ error: 'symbol, side, qty required' });
  try {
    const result = await orderExecutor.exitPosition(symbol, side, parseInt(qty));
    res.json({ success: true, result });
  } catch(err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Webhook — TradingView / Manual Signal ─────────────────
app.post('/api/webhook', async (req, res) => {
  try {
    const body = req.body;
    logger.info('[WEBHOOK] Received: ' + JSON.stringify(body));

    const symbol     = body.symbol;
    const action     = (body.action || body.side || '').toUpperCase(); // BUY or SELL
    const qty        = parseInt(body.qty) || 1;
    const orderType  = (body.orderType || 'MARKET').toUpperCase();
    const price      = parseFloat(body.price) || 0;
    const productType = body.productType || process.env.PRODUCT_TYPE || 'INTRADAY';

    if (!symbol) {
      logger.warn('[WEBHOOK] Missing symbol');
      return res.status(400).json({ success: false, error: 'symbol is required' });
    }
    if (!action || !['BUY','SELL'].includes(action)) {
      logger.warn('[WEBHOOK] Missing or invalid action: ' + action);
      return res.status(400).json({ success: false, error: 'action must be BUY or SELL' });
    }
    if (!fyersAuth.isAuthenticated) {
      logger.warn('[WEBHOOK] Not authenticated with Fyers');
      return res.status(401).json({ success: false, error: 'Not authenticated. Visit /api/auth/url to login.' });
    }
    if (!masterEnabled) {
      logger.warn('[WEBHOOK] Master switch is OFF');
      return res.status(403).json({ success: false, error: 'Master switch is OFF. Enable it from dashboard.' });
    }

    // Risk check
    const riskOk = riskManager.canTrade(symbol, qty, rrConfig);
    if (!riskOk.allowed) {
      logger.warn('[WEBHOOK] Risk check failed: ' + riskOk.reason);
      return res.status(403).json({ success: false, error: 'Risk check failed: ' + riskOk.reason });
    }

    // Place order
    const result = await orderExecutor.placeOrder({
      symbol,
      side:        action,        // 'BUY' or 'SELL'
      qty,
      orderType,                  // 'MARKET' or 'LIMIT'
      price,
      productType
    });

    _addAlert({
      ts:      new Date().toISOString(),
      symbol,
      action,
      qty,
      orderType,
      status:  result.success ? 'PLACED' : 'FAILED',
      orderId: result.orderId || '-',
      error:   result.error   || null
    });

    emit('orderPlaced', { symbol, action, qty, result });

    if (result.success) {
      logger.info('[WEBHOOK] ✅ Order placed: ' + result.orderId);
      res.json({ success: true, orderId: result.orderId, order: result.order });
    } else {
      logger.error('[WEBHOOK] ❌ Order failed: ' + result.error);
      res.status(500).json({ success: false, error: result.error });
    }

  } catch (err) {
    logger.error('[WEBHOOK] Exception: ' + err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});
// ── Webhook (TradingView / Manual) ────────────────────────
app.post('/api/webhook', async (req, res) => {
  try {
    const body = req.body;
    logger.info('[WEBHOOK] Received:', JSON.stringify(body));

    const symbol   = body.symbol;   // e.g. "NSE:SBIN-EQ"
    const action   = body.action;   // "BUY" or "SELL"
    const qty      = body.qty || 1;
    const price    = body.price || 0;
    const orderType = body.orderType || 'MARKET'; // MARKET or LIMIT

    if (!symbol || !action) {
      return res.status(400).json({ success: false, error: 'symbol and action required' });
    }

    if (!fyersAuth.isAuthenticated) {
      return res.status(401).json({ success: false, error: 'Not authenticated with Fyers' });
    }

    if (!masterEnabled) {
      return res.status(403).json({ success: false, error: 'Master switch is OFF' });
    }

    // Place order
  const order = await orderExecutor.placeOrder({
    symbol,
      qty:         parseInt(qty),
      side:        action,          // pass 'BUY' or 'SELL' directly
      orderType:   'MARKET',
      price:       parseFloat(price) || 0,
      productType: 'INTRADAY'
    });
    logger.info('[WEBHOOK] Order placed:', JSON.stringify(order));

    _addAlert({
      ts:      new Date().toISOString(),
      symbol,
      action,
      qty,
      status:  'PLACED',
      orderId: order?.id || order?.order_id || '-'
    });

    emit('orderPlaced', { symbol, action, qty, order });
    res.json({ success: true, order });

  } catch (err) {
    logger.error('[WEBHOOK] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});
// ── Alerts ────────────────────────────────────────────────
app.get('/api/alerts', (req, res) => {
  res.json({ success: true, alerts: alertLog.slice(-100) });
});

// ── Health ────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'ok',
    authenticated: fyersAuth.isAuthenticated,
    masterEnabled,
    selectedSymbols: selectedSymbols.length,
    uptime: Math.floor(process.uptime()) + 's'
  });
});

// ── Serve Frontend ────────────────────────────────────────
if (process.env.NODE_ENV === 'production') {
  const path2 = require('path');
  app.use(express.static(path2.join(__dirname, 'public')));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) return next();
    res.sendFile(path2.join(__dirname, 'public', 'index.html'));
  });
}

// ─────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────
function _addAlert(alert) {
  alertLog.push(alert);
  if (alertLog.length > 500) alertLog.shift();
}

// ─────────────────────────────────────────────────────────
// SOCKET.IO
// ─────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  logger.info(`[SOCKET] Client connected: ${socket.id}`);
  // Send current state on connect
  socket.emit('init', {
    masterEnabled,
    selectedSymbols,
    stockToggles,
    rrConfig,
    authenticated: fyersAuth.isAuthenticated,
    ts: new Date().toISOString()
  });
  socket.on('disconnect', () => {
    logger.info(`[SOCKET] Client disconnected: ${socket.id}`);
  });
});

// ─────────────────────────────────────────────────────────
// FYERS DATA FEED → emit ticks
// ─────────────────────────────────────────────────────────
fyersData.on('tick', (tick) => {
  // Pass tick to ORB engine
  const signal = orbEngine.processTick(tick);
  emit('tick', tick);

  if (signal && masterEnabled) {
    const { symbol, direction } = signal;
    const toggle = stockToggles[symbol];
    if (toggle === false) return; // stock disabled

    const orbLevel = orbEngine.getORBLevel(symbol);
    if (!orbLevel) return;

    const riskOk = riskManager.canTrade(symbol, 1, rrConfig);
    if (!riskOk.allowed) {
      logger.warn(`[ORB] Risk blocked for ${symbol}: ${riskOk.reason}`);
      return;
    }

    const qty = riskManager.calcQty(rrConfig, orbLevel.range);
    logger.info(`[ORB] Signal: ${direction} ${symbol} qty=${qty}`);

    orderExecutor.placeORBTrade({
      symbol,
      direction,
      entry:  direction === 'BUY' ? orbLevel.high : orbLevel.low,
      sl:     direction === 'BUY' ? orbLevel.low  : orbLevel.high,
      target: direction === 'BUY'
        ? orbLevel.high + (orbLevel.range * (rrConfig.rrRatio || 2))
        : orbLevel.low  - (orbLevel.range * (rrConfig.rrRatio || 2)),
      qty
    }).then(results => {
      emit('orbTrade', { symbol, direction, results });
      _addAlert({
        ts: new Date().toISOString(), symbol,
        action: direction, qty,
        status: results.entry?.success ? 'PLACED' : 'FAILED',
        orderId: results.entry?.orderId || '-',
        source: 'ORB'
      });
    });
  }
});

// ─────────────────────────────────────────────────────────
// HISTORICAL CANDLES
// ─────────────────────────────────────────────────────────
app.get('/api/stocks/history', async (req, res) => {
  try {
    const { symbol, resolution = '5', days = 5 } = req.query;
    if (!symbol) return res.status(400).json({ error: 'symbol required' });
    if (!fyersAuth.isAuthenticated) return res.status(401).json({ error: 'Not authenticated' });

    const dayjs = require('dayjs');
    const now   = dayjs();
    const rangeTo   = now.format('YYYY-MM-DD');
    const rangeFrom = now.subtract(parseInt(days), 'day').format('YYYY-MM-DD');

    const candles = await fyersAuth.getHistory({ symbol, resolution, rangeFrom, rangeTo, dateFormat: 1 });

    if (!candles || candles.length === 0)
      return res.json({ success: true, symbol, candles: [], message: 'No data' });

    const formatted = candles.map(c => ({
      time: c[0]*1000, open:c[1], high:c[2], low:c[3], close:c[4], volume:c[5]
    }));
    res.json({ success: true, symbol, resolution, candles: formatted, count: formatted.length });
  } catch (err) {
    logger.error('[HISTORY]', err.message);
    res.json({ success: false, error: err.message, candles: [] });
  }
});

// ─────────────────────────────────────────────────────────
// INSTRUMENTS
// ─────────────────────────────────────────────────────────
let _instrumentsCache = null;
let _instrumentsTime  = 0;

app.get('/api/instruments', async (req, res) => {
  try {
    const axios = require('axios');
    const now = Date.now();
    if (_instrumentsCache && (now - _instrumentsTime) < 6*60*60*1000)
      return res.json({ success: true, count: _instrumentsCache.length, stocks: _instrumentsCache, cached: true });

    const url = 'https://public.fyers.in/sym_details/NSE_CM.csv';
    const response = await axios.get(url, { timeout: 20000 });
    const lines  = response.data.split('\n').filter(Boolean);
    const stocks = [];
    const seen   = new Set();

    lines.forEach((line, idx) => {
      if (idx === 0) return;
      const cols = line.split(',');
      if (cols.length < 11) return;
      let ticker = (cols[11]||'').trim().replace(/"/g,'');
      let name   = (cols[14]||cols[2]||cols[1]||'').trim().replace(/"/g,'');
      if (!ticker.includes('NSE:') || !ticker.includes('-EQ')) {
        for (const col of cols) {
          const t = col.trim().replace(/"/g,'');
          if (t.startsWith('NSE:') && t.endsWith('-EQ')) { ticker = t; break; }
        }
      }
      if (!ticker || !ticker.startsWith('NSE:') || !ticker.endsWith('-EQ')) return;
      if (seen.has(ticker)) return;
      seen.add(ticker);
      if (!name || name.length < 2) name = ticker.replace('NSE:','').replace('-EQ','');
      stocks.push({ symbol: ticker, name: name.slice(0,40), token: (cols[0]||'').trim() });
    });

    if (stocks.length > 0) {
      _instrumentsCache = stocks;
      _instrumentsTime  = now;
      return res.json({ success: true, count: stocks.length, stocks });
    }
    throw new Error('No stocks parsed');
  } catch (err) {
    logger.error('[INSTRUMENTS]', err.message);
    const fallback = [
      {symbol:'NSE:RELIANCE-EQ',name:'Reliance Industries'},{symbol:'NSE:TCS-EQ',name:'TCS'},
      {symbol:'NSE:HDFCBANK-EQ',name:'HDFC Bank'},{symbol:'NSE:INFY-EQ',name:'Infosys'},
      {symbol:'NSE:ICICIBANK-EQ',name:'ICICI Bank'},{symbol:'NSE:SBIN-EQ',name:'SBI'},
      {symbol:'NSE:BHARTIARTL-EQ',name:'Airtel'},{symbol:'NSE:WIPRO-EQ',name:'Wipro'},
      {symbol:'NSE:BAJFINANCE-EQ',name:'Bajaj Finance'},{symbol:'NSE:LT-EQ',name:'L&T'},
      {symbol:'NSE:AXISBANK-EQ',name:'Axis Bank'},{symbol:'NSE:TATAMOTORS-EQ',name:'Tata Motors'},
      {symbol:'NSE:SUNPHARMA-EQ',name:'Sun Pharma'},{symbol:'NSE:DRREDDY-EQ',name:"Dr Reddy's"},
      {symbol:'NSE:TATASTEEL-EQ',name:'Tata Steel'},{symbol:'NSE:ZOMATO-EQ',name:'Zomato'},
    ];
    res.json({ success: true, count: fallback.length, stocks: fallback, fallback: true });
  }
});

// ─────────────────────────────────────────────────────────
// LIVE QUOTE
// ─────────────────────────────────────────────────────────
app.get('/api/stocks/quote/:symbol', async (req, res) => {
  try {
    const symbol = decodeURIComponent(req.params.symbol);
    const tick = fyersData.getLastTick(symbol);
    if (tick) return res.json({ success: true, source: 'websocket', quote: tick });
    if (!fyersAuth.isAuthenticated) return res.json({ success: false, error: 'Not authenticated' });
    const quotes = await fyersAuth.getQuotes([symbol]);
    const q = quotes[0]?.v || {};
    res.json({
      success: true, source: 'rest',
      quote: { symbol, ltp:q.lp||0, open:q.o||0, high:q.h||0, low:q.l||0,
               close:q.c||0, chg:q.ch||0, chgPct:q.chp||0, volume:q.v||0 }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────
// START SERVER
// ─────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  logger.info(`
  ╔══════════════════════════════════════════╗
  ║   ALGO_BOT_ORB — Server Ready           ║
  ║   Port: ${PORT}                             ║
  ╚══════════════════════════════════════════╝
  `);
});

module.exports = { app, server, io };

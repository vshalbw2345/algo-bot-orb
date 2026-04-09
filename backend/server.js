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
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: '*', credentials: false }));
app.use(express.json());
app.use(morgan('tiny'));

const limiter = rateLimit({ windowMs: 60000, max: 200 });
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
    // Redirect to frontend
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
  // Manual token entry from frontend
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
    const funds = await fyersAuth.getFunds();
    // Also compute best available balance guess
    let availableBalance = 0;
    if (funds?.length > 0) {
      // Try every field on every object to find a positive number
      for (const f of funds) {
        for (const key of Object.keys(f)) {
          const v = parseFloat(f[key]);
          if (!isNaN(v) && v > 100) { // any value > 100 is likely a balance
            availableBalance = Math.max(availableBalance, v);
          }
        }
      }
    }
    res.json({ success: true, funds, availableBalance, raw: funds });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Manual / Test Orders ──────────────────────────────────
app.post('/api/orders/place', async (req, res) => {
  const { symbol, side, qty, orderType, price, productType } = req.body;
  const result = await orderExecutor.placeOrder({ symbol, side, qty, orderType, price, productType });
  res.json(result);
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
    msg:    `ORB ${signal.direction} signal → Entry:${signal.entry} SL:${signal.sl} Tgt:${signal.target}`,
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
    emit('orderExecuted', { signal, result });
  } else {
    _updateAlertStatus(signal.symbol, 'ORDER_FAILED');
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

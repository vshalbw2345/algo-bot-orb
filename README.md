# ALGO_BOT_ORB_10_STOCK 🤖📈

> Opening Range Breakout Algo Trading Platform — Fyers API + Node.js + React

---

## 🏗️ ARCHITECTURE

```
┌─────────────────────────────────────────────────────────┐
│  React Frontend (Vite)           :3000                  │
│  ├── Dashboard (10 stock cards, live P&L)               │
│  ├── Live Chart (Canvas candlesticks)                   │
│  ├── Stock Selection (100+ NSE stocks)                  │
│  ├── Test Signal (standalone)                           │
│  ├── Risk & Reward Calculator                           │
│  └── Syntax Generator                                   │
└──────────────────────┬──────────────────────────────────┘
                       │ Socket.io + REST
┌──────────────────────▼──────────────────────────────────┐
│  Node.js / Express Backend       :5000                  │
│  ├── fyersAuth.js    — OAuth2 token management          │
│  ├── fyersData.js    — WebSocket live feed              │
│  ├── orbEngine.js    — ORB strategy + candle builder    │
│  ├── orderExecutor.js— Fyers order placement            │
│  ├── riskManager.js  — Daily limits + halt logic        │
│  └── scheduler.js    — Cron (9:15 open, 15:25 squareoff)│
└──────────────────────┬──────────────────────────────────┘
                       │ REST + WebSocket
┌──────────────────────▼──────────────────────────────────┐
│  Fyers API v2                                            │
│  ├── Auth: api.fyers.in/api/v2/validate-authcode        │
│  ├── Data: wss://socket.fyers.in/data/v3/               │
│  └── Orders: api.fyers.in/api/v2/orders                 │
└─────────────────────────────────────────────────────────┘
```

---

## ⚡ QUICK START (Local)

### Prerequisites
- Node.js 18+
- Fyers Trading Account
- Fyers API App (from myapi.fyers.in)

### Step 1 — Clone & Install

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### Step 2 — Create Fyers API App

1. Go to **https://myapi.fyers.in**
2. Login → My Apps → Create App
3. Set Redirect URL: `http://localhost:5000/api/auth/callback`
4. Copy **App ID** and **Secret Key**

### Step 3 — Configure Environment

```bash
# In /backend, copy .env.example to .env
cp .env.example .env

# Fill in your values:
FYERS_APP_ID=YOUR_APP_ID-100
FYERS_SECRET_KEY=YOUR_SECRET_KEY
FYERS_REDIRECT_URI=http://localhost:5000/api/auth/callback
PORT=5000
FRONTEND_URL=http://localhost:3000
DEFAULT_CAPITAL=50000
DEFAULT_LEVERAGE=5
DEFAULT_RISK_PCT=2
DEFAULT_RR_RATIO=2
MAX_SL_PER_DAY=3
```

### Step 4 — Start Backend

```bash
cd backend
npm run dev
# Server starts at http://localhost:5000
```

### Step 5 — Start Frontend

```bash
cd frontend
npm run dev
# Opens at http://localhost:3000
```

### Step 6 — Authenticate with Fyers

1. Open app → Click **API Credentials** in sidebar
2. Click **Open Fyers Login Page**
3. Log in with your Fyers credentials and authorise
4. You'll be redirected back — status turns green ✅

### Step 7 — Add Stocks & Start Trading

1. Click **Stock Selection** → Select up to 10 NSE stocks
2. Click **Save & Subscribe to Feed**
3. Go to **Dashboard** → Turn on **Master Trade Control**
4. ORB engine starts monitoring at **9:15 AM**
5. Signals fire automatically at **9:20 AM** onwards

---

## 🌐 DEPLOY ON RENDER.COM (Production)

### Backend Deployment

1. Push your code to GitHub
2. Go to **render.com** → New → Web Service
3. Connect your GitHub repo
4. Set:
   - **Build command**: `cd backend && npm install`
   - **Start command**: `cd backend && node server.js`
   - **Root directory**: `/`
5. Add Environment Variables (same as .env):
   ```
   FYERS_APP_ID         = your_app_id
   FYERS_SECRET_KEY     = your_secret_key
   FYERS_REDIRECT_URI   = https://your-app.onrender.com/api/auth/callback
   FRONTEND_URL         = https://your-frontend.vercel.app
   NODE_ENV             = production
   PORT                 = 5000
   ```
6. Deploy → Copy your Render URL

### Frontend Deployment (Vercel)

1. Go to **vercel.com** → Import from GitHub
2. Set framework: **Vite**
3. Set root: `frontend`
4. Add env variable:
   ```
   VITE_API_URL = https://your-backend.onrender.com
   ```
5. Deploy

### Update Fyers App Redirect URL

Go back to **myapi.fyers.in** → Your App → Edit
Update Redirect URL to: `https://your-backend.onrender.com/api/auth/callback`

---

## 📡 API ENDPOINTS

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/auth/url` | Get Fyers OAuth URL |
| GET | `/api/auth/callback` | Token exchange callback |
| GET | `/api/auth/status` | Auth status + profile |
| POST | `/api/auth/token` | Set token manually |

### Stocks & Data
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/stocks/select` | Set watchlist |
| GET | `/api/stocks/orb` | Get ORB levels |
| GET | `/api/stocks/ticks` | All last ticks |
| GET | `/api/stocks/candles/:symbol?tf=5M` | Candle data |

### Orders
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/orders/place` | Manual order |
| POST | `/api/orders/test` | Test signal |
| POST | `/api/orders/cancel/:id` | Cancel order |
| GET | `/api/orders/history` | Order log |

### Risk & Control
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/risk/status` | Risk dashboard data |
| POST | `/api/risk/config` | Update R&R config |
| POST | `/api/risk/resume` | Resume halted trading |
| POST | `/api/control/master` | Toggle master trading |
| POST | `/api/control/stock-toggle` | Toggle per-stock |

---

## 🔌 SOCKET.IO EVENTS

### Server → Client
| Event | Data | Description |
|-------|------|-------------|
| `initState` | Full state | On client connect |
| `tick` | `{symbol, tick}` | Live price tick |
| `orbLocked` | `{symbol, high, low}` | ORB levels locked |
| `signal` | Signal object | ORB breakout signal |
| `orderExecuted` | `{signal, result}` | Order placed |
| `tradeExit` | Exit data | SL/Target hit |
| `slTrailed` | `{symbol, newSl}` | SL trailed to entry |
| `pnlUpdate` | P&L data | Every 5 seconds |
| `masterToggle` | `{enabled}` | Master toggle changed |
| `tradingHalted` | `{reason}` | Risk limit hit |
| `systemAlert` | Alert object | System messages |
| `marketOpen/Close` | Timestamp | Market events |

---

## 📊 ORB STRATEGY LOGIC

```
9:15 AM — Market opens. ORB tracking begins.
          First 5-minute candle starts building.

9:20 AM — First candle closes.
          ORB High = High of 9:15–9:20 candle
          ORB Low  = Low  of 9:15–9:20 candle
          These levels are LOCKED for the day.

9:20+ AM — Every 5-minute candle close is checked:

  CANDLE CLOSE > ORB HIGH → BUY SIGNAL
    Entry = Candle close price
    SL    = ORB Low
    Target = Entry + (Entry–SL) × RR Ratio
    Qty   = Risk Amount ÷ SL Points

  CANDLE CLOSE < ORB LOW → SELL SIGNAL
    Entry = Candle close price
    SL    = ORB High
    Target = Entry − (SL−Entry) × RR Ratio

  50% of Target reached → SL trailed to Entry (breakeven)

  SL Hit → Exit + record loss + check daily limit
  Target Hit → Exit + record profit

15:25 PM — All positions auto squared off.
```

---

## ⚠️ IMPORTANT NOTES

1. **Fyers token expires daily at 3:30 AM** — you must re-authenticate each morning
2. **Test in paper trade mode first** — set `PRODUCT_TYPE=INTRADAY` and test with small qty
3. **Render.com free tier** has cold starts — use paid tier ($7/mo) for reliable trading
4. **Network latency** — order execution is ~200–500ms; acceptable for swing entries
5. **Risk limits** — Daily loss cap halts trading automatically; manual resume required
6. **ORB fires only once per stock per day** — no re-entry after first signal
7. **Backtesting** — Use `/api/stocks/candles` with historical data for strategy validation

---

## 📁 FILE STRUCTURE

```
algo-bot-orb/
├── backend/
│   ├── server.js              ← Main server (start here)
│   ├── modules/
│   │   ├── fyersAuth.js       ← OAuth2 + API calls
│   │   ├── fyersData.js       ← Live WebSocket feed
│   │   ├── orbEngine.js       ← ORB strategy engine
│   │   ├── orderExecutor.js   ← Order placement
│   │   ├── riskManager.js     ← Risk controls
│   │   ├── scheduler.js       ← Cron jobs
│   │   └── logger.js          ← Winston logger
│   ├── package.json
│   ├── .env.example
│   └── logs/                  ← Auto-created
│
└── frontend/
    ├── src/
    │   └── App.jsx            ← Full React app
    ├── vite.config.js
    └── package.json
```

---

## 🛠️ TECH STACK

| Layer | Tech |
|-------|------|
| Frontend | React 18 + Vite |
| Real-time UI | Socket.io client |
| HTTP client | Axios |
| Icons | Lucide React |
| Backend | Node.js + Express |
| Real-time server | Socket.io |
| Live data | Fyers WebSocket v3 |
| Orders | Fyers REST API v2 |
| Scheduling | node-cron |
| Logging | Winston |
| Deployment | Render.com + Vercel |

---

Built for ORB intraday trading on NSE stocks via Fyers broker.

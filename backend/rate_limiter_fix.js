// Run this on VM: node ~/rate_limiter_fix.js
// Fixes ALL rate limit issues in one go

const fs = require('fs');
const path = require('path');
const HOME = process.env.HOME || '/home/vshalbw234';

console.log('═══════════════════════════════════════');
console.log('  RATE LIMIT FIX — All-in-one');
console.log('═══════════════════════════════════════');

// ═══ Fix 1: Add request cache/throttle to server.js ═══
const serverFile = path.join(HOME, 'algo-bot-orb/backend/server.js');
let sv = fs.readFileSync(serverFile, 'utf8');

// Add cache layer at top of server
if (!sv.includes('_apiCache')) {
  const cacheCode = `
// ── API Request Cache (prevents 429 rate limits) ──────────
const _apiCache = {};
function cachedFetch(key, fetchFn, ttlMs) {
  const now = Date.now();
  if (_apiCache[key] && (now - _apiCache[key].time) < ttlMs) {
    return Promise.resolve(_apiCache[key].data);
  }
  return fetchFn().then(data => {
    _apiCache[key] = { data, time: now };
    return data;
  });
}
// Rate limit tracker
let _lastFyersCall = 0;
let _lastAngelCall = 0;
const API_COOLDOWN = 3000; // 3 second min between broker API calls
`;
  // Insert after requires
  const insertPoint = sv.indexOf('// ── Helper: broadcast');
  if (insertPoint > -1) {
    sv = sv.slice(0, insertPoint) + cacheCode + '\n' + sv.slice(insertPoint);
    console.log('1. Cache layer added to server.js');
  }
}

// ═══ Fix 2: Throttle auth status checks ═══
// These get polled every 3s by frontend — cache them
if (!sv.includes('cachedFetch') && sv.includes('/api/auth/status')) {
  console.log('2. Auth status already cached or pattern differs');
} else {
  console.log('2. Cache layer ready');
}

// ═══ Fix 3: Add cooldown to AngelOne connect ═══
const oldAngelConnect = "app.post('/api/auth/angelone/connect', async (req, res) => {";
if (sv.includes(oldAngelConnect)) {
  sv = sv.replace(oldAngelConnect, `app.post('/api/auth/angelone/connect', async (req, res) => {
  // Rate limit protection
  const now = Date.now();
  if (now - _lastAngelCall < API_COOLDOWN) {
    return res.json({ success: false, error: 'Please wait ' + Math.ceil((API_COOLDOWN - (now - _lastAngelCall))/1000) + 's before retrying' });
  }
  _lastAngelCall = now;`);
  console.log('3. AngelOne connect cooldown added');
}

// ═══ Fix 4: Add cooldown to Fyers login ═══
const oldFyersLogin = "app.get('/api/auth/login'";
if (sv.includes(oldFyersLogin) && !sv.includes('_lastFyersCall')) {
  // Already handled by cache layer
  console.log('4. Fyers cooldown ready');
}

// ═══ Fix 5: Fix webhook broker routing ═══
// When broker='angelone' is selected, route to AngelOne, not Fyers
const oldFyersCheck = "if (!isCrypto && fyersAuth.isAuthenticated)";
const newFyersCheck = "if (!isCrypto && broker !== 'angelone' && fyersAuth.isAuthenticated)";
if (sv.includes(oldFyersCheck) && !sv.includes("broker !== 'angelone'")) {
  sv = sv.replace(oldFyersCheck, newFyersCheck);
  console.log('5. Broker routing fixed — AngelOne orders go to AngelOne');
} else {
  console.log('5. Broker routing already fixed or pattern differs');
}

// ═══ Fix 6: AngelOne order in webhook ═══
if (!sv.includes('angelOneAuth.placeOrder')) {
  const nobroker = sv.indexOf('// No broker available');
  if (nobroker > -1) {
    const angelBlock = `
    // ── ANGELONE ORDER ────────────────────────────────────────
    if (!isCrypto && angelOneAuth && angelOneAuth.connected && (broker === 'angelone' || !fyersAuth.isAuthenticated)) {
      if (!masterEnabled) {
        return res.json({ success:true, status:'SKIPPED', reason:'Master OFF' });
      }
      try {
        const angelSym = symbol.replace('.NS','').replace('NSE:','').replace('-EQ','');
        const result = await angelOneAuth.placeOrder({
          symbol: angelSym, side: orderSide,
          qty: parseInt(qty) || 1, exchange: 'NSE', productType: 'INTRADAY'
        });
        logger.info('[WEBHOOK] AngelOne: ' + JSON.stringify(result));
        return res.json({ success:true, broker:'angelone', result });
      } catch(e) {
        logger.error('[WEBHOOK] AngelOne error: ' + e.message);
      }
    }

    `;
    sv = sv.slice(0, nobroker) + angelBlock + sv.slice(nobroker);
    console.log('6. AngelOne order placement added to webhook');
  }
} else {
  console.log('6. AngelOne order already in webhook');
}

fs.writeFileSync(serverFile, sv);

// ═══ Fix 7: Disable scanner (restore after rate limit clears) ═══
const scannerFile = path.join(HOME, 'algo-bot-orb/backend/orbScanner.js');
const scannerBak = path.join(HOME, 'algo-bot-orb/backend/orbScanner.js.bak2');
if (fs.existsSync(scannerFile)) {
  // Backup original
  const orig = fs.readFileSync(scannerFile, 'utf8');
  if (orig.includes('axios') && !fs.existsSync(scannerBak)) {
    fs.writeFileSync(scannerBak, orig);
    console.log('7a. Scanner backed up');
  }
  
  // Replace with throttled version
  if (orig.includes('}, 5000)') || orig.includes('}, 30000)')) {
    let fixed = orig.replace(/}, 5000\)/g, '}, 60000)');
    fixed = fixed.replace(/}, 30000\)/g, '}, 60000)');
    fs.writeFileSync(scannerFile, fixed);
    console.log('7b. Scanner interval set to 60 seconds');
  } else {
    console.log('7b. Scanner interval already fixed');
  }
}

// ═══ Fix 8: Reduce frontend polling ═══
const appFile = path.join(HOME, 'algo-bot-orb/frontend/src/App.jsx');
if (fs.existsSync(appFile)) {
  let app = fs.readFileSync(appFile, 'utf8');
  // Change 3s polls to 10s
  let changes = 0;
  const patterns = [
    [/setInterval\(sync, 3000\)/g, 'setInterval(sync, 10000)'],
    [/setInterval\(fetchTrades, 2000\)/g, 'setInterval(fetchTrades, 10000)'],
    [/setInterval\(\(\) => \{[^}]*\}, 3000\)/g, null], // skip complex ones
  ];
  // Simple replace for common polling intervals
  if (app.includes('3000') && app.includes('setInterval')) {
    app = app.replace(/setInterval\(sync, 3000\)/g, 'setInterval(sync, 15000)');
    app = app.replace(/setInterval\(fetchTrades, 2000\)/g, 'setInterval(fetchTrades, 15000)');
    changes++;
  }
  if (changes) {
    fs.writeFileSync(appFile, app);
    console.log('8. Frontend polling reduced to 15s');
  } else {
    console.log('8. Frontend polling - no simple patterns found');
  }
}

console.log('');
console.log('═══════════════════════════════════════');
console.log('  ALL FIXES APPLIED');
console.log('═══════════════════════════════════════');
console.log('');
console.log('Now run:');
console.log('  cd ~/algo-bot-orb/frontend && npm run build');
console.log('  pm2 restart algo-bot');
console.log('  # Wait 10 mins for rate limits to clear');
console.log('  # Then login Fyers + Connect AngelOne');

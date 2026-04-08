// ─────────────────────────────────────────────────────────
// modules/scheduler.js — Daily Scheduled Tasks
//
// Schedule:
//   8:55 AM  — Pre-market warmup (connect feed)
//   9:15 AM  — Market open: start ORB tracking
//   9:20 AM  — ORB window closes; levels locked
//   15:20 AM — Square off warning
//   15:25 AM — Auto square off all positions
//   15:30 AM — Market close: disconnect feed, save logs
//   Midnight — Daily reset
// ─────────────────────────────────────────────────────────
const cron   = require('node-cron');
const logger = require('./logger');

let orbEngine, orderExecutor, riskManager, dataFeed, socketEmit;

function init({ orb, executor, risk, feed, emitFn }) {
  orbEngine     = orb;
  orderExecutor = executor;
  riskManager   = risk;
  dataFeed      = feed;
  socketEmit    = emitFn;
  _registerJobs();
  logger.info('[SCHEDULER] All cron jobs registered');
}

function _registerJobs() {
  // ── 8:55 AM Mon–Fri: Warmup ───────────────────────────
  cron.schedule('55 8 * * 1-5', () => {
    logger.info('[SCHEDULER] 🌅 Pre-market warmup (8:55 AM)');
    socketEmit('systemAlert', { msg: 'Pre-market warmup. Fyers feed connecting...', type: 'INFO' });
  }, { timezone: 'Asia/Kolkata' });

  // ── 9:15 AM Mon–Fri: Market Open ─────────────────────
  cron.schedule('15 9 * * 1-5', () => {
    logger.info('[SCHEDULER] 🔔 Market OPEN 9:15 AM — ORB tracking started');
    socketEmit('marketOpen', { time: new Date().toISOString() });
    socketEmit('systemAlert', { msg: '9:15 AM — Market open. ORB tracking active.', type: 'SUCCESS' });
  }, { timezone: 'Asia/Kolkata' });

  // ── 9:20 AM Mon–Fri: ORB Window Closed ───────────────
  cron.schedule('20 9 * * 1-5', () => {
    logger.info('[SCHEDULER] 🔒 9:20 AM — ORB window closed. Monitoring breakouts...');
    socketEmit('orbWindowClose', { time: new Date().toISOString() });
    socketEmit('systemAlert', { msg: '9:20 AM — ORB levels locked. Monitoring breakouts now.', type: 'INFO' });
  }, { timezone: 'Asia/Kolkata' });

  // ── 15:20 PM Mon–Fri: Square off warning ─────────────
  cron.schedule('20 15 * * 1-5', () => {
    logger.info('[SCHEDULER] ⚠️ 15:20 PM — Square off in 5 minutes');
    socketEmit('systemAlert', { msg: '⚠️ 15:20 PM — Auto square-off in 5 minutes!', type: 'WARNING' });
  }, { timezone: 'Asia/Kolkata' });

  // ── 15:25 PM Mon–Fri: Auto square off all positions ──
  cron.schedule('25 15 * * 1-5', async () => {
    logger.info('[SCHEDULER] 🏁 15:25 PM — Auto square off all open positions');
    socketEmit('squareOffStarted', { time: new Date().toISOString() });

    try {
      const positions = await require('./fyersAuth').getPositions();
      const openPos   = positions.filter(p => p.netQty !== 0);

      for (const pos of openPos) {
        const side = pos.netQty > 0 ? 'SELL' : 'BUY';
        await orderExecutor.placeOrder({
          symbol:      pos.symbol,
          side,
          qty:         Math.abs(pos.netQty),
          orderType:   'MARKET',
          productType: 'INTRADAY'
        });
        logger.info(`[SCHEDULER] Squared off: ${pos.symbol} (${side} ${Math.abs(pos.netQty)})`);
      }

      socketEmit('squareOffDone', { count: openPos.length, time: new Date().toISOString() });
      socketEmit('systemAlert', { msg: `✅ ${openPos.length} position(s) squared off at 15:25`, type: 'SUCCESS' });
    } catch (err) {
      logger.error('[SCHEDULER] Square off failed:', err.message);
      socketEmit('systemAlert', { msg: `❌ Auto square off error: ${err.message}`, type: 'ERROR' });
    }
  }, { timezone: 'Asia/Kolkata' });

  // ── 15:30 PM Mon–Fri: Market Close ───────────────────
  cron.schedule('30 15 * * 1-5', () => {
    logger.info('[SCHEDULER] 🔴 Market CLOSED 15:30 PM');
    dataFeed.disconnect();
    socketEmit('marketClose', { time: new Date().toISOString() });
    socketEmit('systemAlert', { msg: '15:30 PM — Market closed. Feed disconnected.', type: 'INFO' });
  }, { timezone: 'Asia/Kolkata' });

  // ── Midnight Mon–Fri: Daily Reset ────────────────────
  cron.schedule('0 0 * * 1-5', () => {
    logger.info('[SCHEDULER] 🔄 Midnight — Daily reset');
    orbEngine.dailyReset();
    riskManager.dailyReset();
    socketEmit('dailyReset', { time: new Date().toISOString() });
  }, { timezone: 'Asia/Kolkata' });

  // ── Order status sync every 10 seconds (market hours) ─
  cron.schedule('*/10 * * * * *', async () => {
    if (!riskManager.isMarketHours()) return;
    try { await orderExecutor.syncOrderStatus(); } catch (_) {}
  });
}

module.exports = { init };

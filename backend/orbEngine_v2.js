// ═══════════════════════════════════════════════════════════════
// orbEngine.js — UNIFIED ORB Engine (Single Source of Truth)
// Used by: AlgoBot server, Chart, Backtest
// Location: algo-bot-orb/backend/orbEngine_v2.js
//
// API: POST /api/orb/check
//   Input:  { candles: [...], rrConfig: {...} }
//   Output: { orbLevels, signals, activeTrade }
// ═══════════════════════════════════════════════════════════════

class ORBEngineV2 {
  constructor() {}

  // ── Main: Process candles and return all signals ──────────
  // This is the ONLY place ORB logic lives.
  // Every app calls this — no duplicate logic anywhere.
  process(candles, rrConfig) {
    if (!candles || !candles.length) return { orbLevels: {}, signals: [], activeTrade: null, error: 'No candles' };

    // Step 1: Find ORB levels per day
    const dayMap = this._findORBLevels(candles);

    // Step 2: Scan all candles for signals
    const result = this._scanSignals(candles, dayMap, rrConfig);

    return {
      orbLevels: dayMap,
      signals: result.signals,
      activeTrade: result.activeTrade,
      summary: result.summary
    };
  }

  // ── Find ORB High/Low per day ─────────────────────────────
  // First 5-min candle of each trading day (9:15-9:25 IST)
  _findORBLevels(candles) {
    const dayMap = {};
    for (const c of candles) {
      const d = new Date(c.time * 1000);
      const utcMins = d.getUTCHours() * 60 + d.getUTCMinutes();
      const istMins = (utcMins + 330) % (24 * 60);
      const istH = Math.floor(istMins / 60);
      const istMn = istMins % 60;
      const dateStr = d.toDateString();

      // 9:15 to 9:25 IST = opening candle
      if (istH === 9 && istMn >= 15 && istMn <= 25 && !dayMap[dateStr]) {
        dayMap[dateStr] = {
          high: c.high,
          low: c.low,
          date: dateStr,
          time: c.time,
          ist: istH + ':' + (istMn < 10 ? '0' : '') + istMn
        };
      }
    }
    return dayMap;
  }

  // ── Scan for BUY/SELL signals ─────────────────────────────
  // Pine Script exact logic:
  //   BUY  = candle CLOSE > ORB_High AND candle LOW  <= ORB_High
  //   SELL = candle CLOSE < ORB_Low  AND candle HIGH >= ORB_Low
  //
  // Guards:
  //   - Only after 9:25 IST (let opening candle close)
  //   - Max 1 BUY + 1 SELL per day
  //   - Active trade blocks new signals until SL/TGT hit
  _scanSignals(candles, dayMap, rr) {
    const signals = [];
    const dailyState = {}; // { dateStr: { buyFired, sellFired } }
    let activeTrade = null;
    let totalPnl = 0;
    let wins = 0, losses = 0;

    for (const c of candles) {
      const d = new Date(c.time * 1000);
      const dateStr = d.toDateString();
      const utcMins = d.getUTCHours() * 60 + d.getUTCMinutes();
      const istMins = (utcMins + 330) % (24 * 60);

      // Initialize daily state
      if (!dailyState[dateStr]) {
        dailyState[dateStr] = { buyFired: false, sellFired: false };
        // Reset active trade on new day
        if (activeTrade) {
          // Force close at market end of previous day
          activeTrade = null;
        }
      }

      const orb = dayMap[dateStr];
      if (!orb) continue;

      // Skip before 9:25 IST (565 mins from midnight)
      if (istMins < 565) continue;

      const timeStr = new Date(c.time * 1000).toLocaleTimeString('en-IN');
      const day = dailyState[dateStr];

      // ── Check active trade SL/TGT first ──────────────────
      if (activeTrade) {
        let exitType = null, exitPrice = null;

        if (activeTrade.direction === 'BUY') {
          // BUY trade: SL when price drops to SL, TGT when price rises to TGT
          if (c.low <= activeTrade.sl) {
            exitType = 'SL HIT';
            exitPrice = activeTrade.sl;
          } else if (c.high >= activeTrade.tgt) {
            exitType = 'TGT HIT';
            exitPrice = activeTrade.tgt;
          }
        } else {
          // SELL trade: SL when price rises to SL, TGT when price drops to TGT
          if (c.high >= activeTrade.sl) {
            exitType = 'SL HIT';
            exitPrice = activeTrade.sl;
          } else if (c.low <= activeTrade.tgt) {
            exitType = 'TGT HIT';
            exitPrice = activeTrade.tgt;
          }
        }

        if (exitType) {
          const pnl = activeTrade.direction === 'BUY'
            ? (exitPrice - activeTrade.entry) * activeTrade.qty
            : (activeTrade.entry - exitPrice) * activeTrade.qty;

          signals.push({
            action: 'EXIT',
            direction: activeTrade.direction === 'BUY' ? 'SELL' : 'BUY', // exit is opposite
            originalDirection: activeTrade.direction,
            exitType,
            entry: activeTrade.entry,
            exit: parseFloat(exitPrice.toFixed(2)),
            sl: activeTrade.sl,
            tgt: activeTrade.tgt,
            qty: activeTrade.qty,
            pnl: parseFloat(pnl.toFixed(2)),
            date: dateStr,
            time: timeStr,
            candle: { open: c.open, high: c.high, low: c.low, close: c.close },
            orbHigh: orb.high,
            orbLow: orb.low
          });

          totalPnl += pnl;
          if (pnl > 0) wins++; else losses++;
          activeTrade = null;
        }
        continue; // active trade — no new signals
      }

      // ── Check for new ORB breakout ────────────────────────

      // BUY: candle CLOSES ABOVE ORB High AND candle LOW touched ORB High
      const isBuy = (c.close > orb.high) && (c.low <= orb.high);

      // SELL: candle CLOSES BELOW ORB Low AND candle HIGH touched ORB Low
      const isSell = (c.close < orb.low) && (c.high >= orb.low);

      // CRITICAL: Price above ORB High can ONLY be BUY, never SELL
      //           Price below ORB Low  can ONLY be SELL, never BUY
      if (isBuy && !day.buyFired) {
        day.buyFired = true;
        const trade = this._buildTrade('BUY', c.close, rr);
        activeTrade = trade;

        signals.push({
          action: 'ENTRY',
          direction: 'BUY',
          entry: trade.entry,
          sl: trade.sl,
          tgt: trade.tgt,
          qty: trade.qty,
          riskPct: trade.riskPct,
          rrRatio: trade.rrRatio,
          date: dateStr,
          time: timeStr,
          candle: { open: c.open, high: c.high, low: c.low, close: c.close },
          orbHigh: orb.high,
          orbLow: orb.low,
          reason: `Close(${c.close.toFixed(2)}) > ORB_H(${orb.high}) AND Low(${c.low.toFixed(2)}) <= ORB_H`
        });
      }

      if (isSell && !day.sellFired) {
        day.sellFired = true;
        const trade = this._buildTrade('SELL', c.close, rr);
        activeTrade = trade;

        signals.push({
          action: 'ENTRY',
          direction: 'SELL',
          entry: trade.entry,
          sl: trade.sl,
          tgt: trade.tgt,
          qty: trade.qty,
          riskPct: trade.riskPct,
          rrRatio: trade.rrRatio,
          date: dateStr,
          time: timeStr,
          candle: { open: c.open, high: c.high, low: c.low, close: c.close },
          orbHigh: orb.high,
          orbLow: orb.low,
          reason: `Close(${c.close.toFixed(2)}) < ORB_L(${orb.low}) AND High(${c.high.toFixed(2)}) >= ORB_L`
        });
      }
    }

    return {
      signals,
      activeTrade,
      summary: {
        totalTrades: signals.filter(s => s.action === 'ENTRY').length,
        wins,
        losses,
        open: activeTrade ? 1 : 0,
        totalPnl: parseFloat(totalPnl.toFixed(2)),
        winRate: (wins + losses) > 0 ? ((wins / (wins + losses)) * 100).toFixed(1) + '%' : '0%'
      }
    };
  }

  // ── Build trade with RR ─────────────────────────────────
  _buildTrade(direction, price, rr) {
    const rp = rr.riskPct || 1;
    const rrRatio = rr.rrRatio || 2;
    const cap = rr.capital || 593;
    const lev = rr.leverage || 4;
    const effCap = cap * lev;
    const riskAmt = effCap * rp / 100;
    const slDist = price * rp / 100;
    const qty = Math.max(1, Math.floor(riskAmt / slDist));

    const sl = direction === 'BUY' ? price - slDist : price + slDist;
    const tgt = direction === 'BUY' ? price + slDist * rrRatio : price - slDist * rrRatio;

    return {
      direction,
      entry: parseFloat(price.toFixed(2)),
      sl: parseFloat(sl.toFixed(2)),
      tgt: parseFloat(tgt.toFixed(2)),
      qty,
      riskPct: rp,
      rrRatio
    };
  }

  // ── Check single candle (for live scanner) ────────────────
  // Used by orbScanner.js for real-time checking
  checkCandle(candle, orbLevels, dailyState, activeTrade, rr) {
    if (!orbLevels || !orbLevels.high || !orbLevels.low) return { signal: null, activeTrade };

    const c = candle;
    const d = new Date(c.time * 1000);
    const utcMins = d.getUTCHours() * 60 + d.getUTCMinutes();
    const istMins = (utcMins + 330) % (24 * 60);
    if (istMins < 565) return { signal: null, activeTrade }; // before 9:25

    // Check active trade exit
    if (activeTrade) {
      if (activeTrade.direction === 'BUY') {
        if (c.low <= activeTrade.sl) return { signal: { action: 'EXIT', exitType: 'SL HIT', direction: 'SELL', price: activeTrade.sl, pnl: (activeTrade.sl - activeTrade.entry) * activeTrade.qty }, activeTrade: null };
        if (c.high >= activeTrade.tgt) return { signal: { action: 'EXIT', exitType: 'TGT HIT', direction: 'SELL', price: activeTrade.tgt, pnl: (activeTrade.tgt - activeTrade.entry) * activeTrade.qty }, activeTrade: null };
      } else {
        if (c.high >= activeTrade.sl) return { signal: { action: 'EXIT', exitType: 'SL HIT', direction: 'BUY', price: activeTrade.sl, pnl: (activeTrade.entry - activeTrade.sl) * activeTrade.qty }, activeTrade: null };
        if (c.low <= activeTrade.tgt) return { signal: { action: 'EXIT', exitType: 'TGT HIT', direction: 'BUY', price: activeTrade.tgt, pnl: (activeTrade.entry - activeTrade.tgt) * activeTrade.qty }, activeTrade: null };
      }
      return { signal: null, activeTrade };
    }

    // Check breakout
    const isBuy = (c.close > orbLevels.high) && (c.low <= orbLevels.high);
    const isSell = (c.close < orbLevels.low) && (c.high >= orbLevels.low);

    if (isBuy && !dailyState.buyFired) {
      dailyState.buyFired = true;
      const trade = this._buildTrade('BUY', c.close, rr);
      return { signal: { action: 'ENTRY', direction: 'BUY', ...trade, reason: `Close > ORB_H AND Low <= ORB_H` }, activeTrade: trade };
    }

    if (isSell && !dailyState.sellFired) {
      dailyState.sellFired = true;
      const trade = this._buildTrade('SELL', c.close, rr);
      return { signal: { action: 'ENTRY', direction: 'SELL', ...trade, reason: `Close < ORB_L AND High >= ORB_L` }, activeTrade: trade };
    }

    return { signal: null, activeTrade };
  }
}

module.exports = ORBEngineV2;

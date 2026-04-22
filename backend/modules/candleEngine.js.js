// candleEngine.js

const TF_MAP = {
  '1m': 1,
  '5m': 5,
  '15m': 15,
  '30m': 30,
  '1h': 60,
};

const store = {}; // {symbol: {tf: [candles]}}

function getBucket(ts, minutes) {
  return Math.floor(ts / (minutes * 60 * 1000)) * (minutes * 60);
}

function update(symbol, tick) {
  const now = tick.ts;

  Object.keys(TF_MAP).forEach(tf => {
    const minutes = TF_MAP[tf];

    if (!store[symbol]) store[symbol] = {};
    if (!store[symbol][tf]) store[symbol][tf] = [];

    const bucket = getBucket(now, minutes);
    const arr = store[symbol][tf];
    let last = arr[arr.length - 1];

    if (!last || last.time !== bucket) {
      // close previous candle automatically
      const candle = {
        time: bucket,
        open: tick.ltp,
        high: tick.ltp,
        low: tick.ltp,
        close: tick.ltp,
        volume: tick.volume || 0,
        closed: false
      };
      arr.push(candle);
    } else {
      last.high = Math.max(last.high, tick.ltp);
      last.low = Math.min(last.low, tick.ltp);
      last.close = tick.ltp;
      last.volume = tick.volume;
    }

    // mark previous candle closed
    if (arr.length > 1) {
      arr[arr.length - 2].closed = true;
    }

    // limit memory
    if (arr.length > 2000) arr.shift();
  });
}

function getCandles(symbol, tf) {
  return store[symbol]?.[tf] || [];
}

module.exports = {
  update,
  getCandles
};
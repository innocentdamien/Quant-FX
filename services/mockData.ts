
import { OHLCV } from '../types';

export const generateMockData = (count: number = 200, volatility: number = 200, interval: number = 3600): OHLCV[] => {
  const data: OHLCV[] = [];
  let currentPrice = volatility > 100 ? 68000 : (volatility < 0.1 ? 1.0850 : 2300);
  let currentTime = Math.floor(Date.now() / 1000) - count * interval;

  for (let i = 0; i < count; i++) {
    const candle = generateNextCandle(currentPrice, volatility, interval, currentTime);
    data.push(candle);
    currentPrice = candle.close;
    currentTime += interval;
  }
  return data;
};

// Fix: Completed the implementation of generateNextCandle to ensure it returns a valid OHLCV object and resolved the "must return a value" error.
export const generateNextCandle = (prevClose: number, volatility: number, interval: number, time: number): OHLCV => {
  const change = (Math.random() - 0.5) * (volatility * (interval / 3600));
  const isBigMove = Math.random() > 0.96;
  const multiplier = isBigMove ? (Math.random() > 0.5 ? 4.0 : -4.0) : 1;
  
  const open = prevClose;
  const close = open + (change * multiplier);
  const high = Math.max(open, close) + (Math.random() * (volatility / 10));
  const low = Math.min(open, close) - (Math.random() * (volatility / 10));
  const volume = Math.random() * 1000 + (isBigMove ? 5000 : 0);

  return {
    time,
    open,
    high,
    low,
    close,
    volume
  };
};

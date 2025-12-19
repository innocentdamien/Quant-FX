
import { Asset } from './types';

export const COLORS = {
  CHART_BG: '#0c0e12',
  CHART_GRID: '#1e222d',
  BULL_CANDLE: '#26a69a',
  BEAR_CANDLE: '#ef5350',
  FVG_COLOR: 'rgba(56, 189, 248, 0.2)',
  OB_COLOR: 'rgba(129, 140, 248, 0.3)',
  LIQUIDITY_COLOR: 'rgba(234, 179, 8, 0.2)',
  TEXT: '#d1d5db'
};

export const ASSETS: Asset[] = [
  { symbol: 'BTC/USDT', category: 'CRYPTO', volatility: 500 },
  { symbol: 'EUR/USD', category: 'FOREX', volatility: 0.0050 },
  { symbol: 'XAU/USD', category: 'METALS', volatility: 25 },
  { symbol: 'ES1!', category: 'FUTURES', volatility: 40 },
  { symbol: 'NVDA', category: 'OPTIONS', volatility: 15 }
];

export const TIMEFRAMES = [
  { label: '1M', value: '1m', seconds: 60 },
  { label: '3M', value: '3m', seconds: 180 },
  { label: '5M', value: '5m', seconds: 300 },
  { label: '15M', value: '15m', seconds: 900 },
  { label: '30M', value: '30m', seconds: 1800 },
  { label: '1H', value: '1h', seconds: 3600 },
  { label: '2H', value: '2h', seconds: 7200 },
  { label: '4H', value: '4h', seconds: 14400 },
  { label: '1D', value: '1d', seconds: 86400 }
];

export const TIMEZONES = [
  { label: 'Local', value: Intl.DateTimeFormat().resolvedOptions().timeZone },
  { label: 'UTC', value: 'UTC' },
  { label: 'New York', value: 'America/New_York' },
  { label: 'London', value: 'Europe/London' },
  { label: 'Tokyo', value: 'Asia/Tokyo' },
  { label: 'Dubai', value: 'Asia/Dubai' }
];

export const DEFAULT_TIMEFRAME = TIMEFRAMES.find(tf => tf.value === '1h') || TIMEFRAMES[5];
export const DEFAULT_TIMEZONE = TIMEZONES[0];

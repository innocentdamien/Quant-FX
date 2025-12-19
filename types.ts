
export enum ZoneType {
  FVG = 'FVG',
  OB = 'Order Block',
  LIQUIDITY_SWEEP = 'Liquidity Sweep'
}

export type ViewState = 'dashboard' | 'scanner' | 'backtester' | 'strategy' | 'intelligence';

export interface Asset {
  symbol: string;
  category: 'CRYPTO' | 'FOREX' | 'METALS' | 'FUTURES' | 'OPTIONS';
  volatility: number;
}

export interface OHLCV {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  isFinal?: boolean; // New: indicates if the candle has closed
}

export interface SMCZone {
  id: string;
  type: ZoneType;
  top: number;
  bottom: number;
  startTime: number;
  endTime?: number;
  isMitigated: boolean;
  strengthScore: number;
  displacement?: number;
  direction: 'BULLISH' | 'BEARISH';
  equilibrium: number; // The 50% level of the zone
}

export interface TradeLog {
  id: string;
  entryTime: number;
  exitTime?: number;
  type: 'LONG' | 'SHORT';
  entryPrice: number;
  sl: number;
  tp: number;
  rr: number;
  aiScore: number;
  setupType: string;
  status: 'OPEN' | 'WON' | 'LOST';
}

export interface AIValidationResult {
  score: number;
  reasoning: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  suggestion: string; // Actionable advice for the trader
}

export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  source: string;
  url: string;
  timestamp: string;
  sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
}

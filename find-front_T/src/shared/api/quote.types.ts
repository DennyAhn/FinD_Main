// Quote API 타입 정의

export interface QuoteItem {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  isUp: boolean;
  volume?: number;
  updatedAt?: string;
}

export interface QuoteSummaryResponse {
  indices: QuoteItem[];
  forex: QuoteItem[];
  metals: QuoteItem[];
  energy: QuoteItem[];
}

export interface TickerItem {
  symbol: string;
  name: string;
  changePercent: number;
  isUp: boolean;
}

export interface TickerResponse {
  items: TickerItem[];
}

export interface QuoteApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}

// ==================== Indicator Types ====================

export interface RSIData {
  value: number;
  signal: 'oversold' | 'neutral' | 'overbought';
  period: number;
}

export interface MACDData {
  macd: number;
  signal: number;
  histogram: number;
  trend: 'bullish' | 'bearish' | 'neutral';
}

export interface IndicatorSummary {
  symbol: string;
  timeframe: string;
  updatedAt: string;
  rsi: RSIData;
  macd: MACDData;
}

// ==================== Fear & Greed Index ====================

export interface FearGreedData {
  value: number;
  classification: string;
  classificationKo: string;
  timestamp: string;
  timeUntilUpdate?: number;
}

// CNN 주식 시장용 (추가 필드 포함)
export interface StockFearGreedData extends FearGreedData {
  previousClose: number;
  previous1Week: number;
  previous1Month: number;
  previous1Year: number;
}

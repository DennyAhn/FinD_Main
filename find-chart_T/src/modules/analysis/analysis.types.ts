import { Candle } from '../candle/candle.types';

// 기술적 분석 지표 결과 타입
export interface IndicatorResult {
  time: number; // epoch seconds
  value: number | null;
}

export interface MACDResult {
  time: number;
  macd: number | null;
  signal: number | null;
  histogram: number | null;
}

export interface BollingerBandsResult {
  time: number;
  upper: number | null;
  middle: number | null;
  lower: number | null;
}

// 지표 계산 옵션
export interface RSIOptions {
  period?: number; // default: 14
}

export interface MACDOptions {
  fastPeriod?: number;   // default: 12
  slowPeriod?: number;   // default: 26
  signalPeriod?: number; // default: 9
}

export interface BollingerOptions {
  period?: number;     // default: 20
  stdDev?: number;     // default: 2
}

export interface SMAOptions {
  period: number;
}

export interface EMAOptions {
  period: number;
}

// API Request/Response 타입
export interface AnalysisParams {
  symbol: string;
  timeframe: string;
}

export interface AnalysisQuery {
  limit?: string;
  period?: string;
  fastPeriod?: string;
  slowPeriod?: string;
  signalPeriod?: string;
  stdDev?: string;
}

export interface AnalysisResponse<T> {
  symbol: string;
  timeframe: string;
  indicator: string;
  params: Record<string, number>;
  data: T[];
}

// ==================== Performance (성과) ====================

export type PerformancePeriod = '1W' | '1M' | '3M' | '6M' | 'YTD' | '1Y';

export interface PerformanceData {
  period: PerformancePeriod;
  value: number | null;        // 변동률 (%)
  startPrice: number | null;   // 시작 가격
  endPrice: number | null;     // 종료 가격 (현재가)
  startDate: string | null;    // 시작 날짜
}

export interface PerformanceResponse {
  symbol: string;
  currentPrice: number;
  currentDate: string;
  performance: Record<PerformancePeriod, PerformanceData>;
}

// ==================== Seasonal (시즌별) ====================

export interface SeasonalDataPoint {
  date: string;          // YYYY-MM-DD
  dayOfYear: number;     // 1~365
  value: number;         // 연초 대비 변동률 (%)
}

export interface SeasonalYearData {
  year: number;
  startPrice: number;    // 연초 가격
  data: SeasonalDataPoint[];
}

export interface SeasonalResponse {
  symbol: string;
  years: SeasonalYearData[];
}

// ==================== Dashboard Indicators (대시보드용 지표) ====================

export interface RSIData {
  value: number;           // RSI 값 (0~100)
  signal: 'oversold' | 'neutral' | 'overbought';  // 과매도/중립/과매수
  period: number;          // 계산 기간
}

export interface MACDData {
  macd: number;            // MACD 라인
  signal: number;          // 시그널 라인
  histogram: number;       // 히스토그램
  trend: 'bullish' | 'bearish' | 'neutral';  // 추세
}

export interface IndicatorSummary {
  symbol: string;
  timeframe: string;       // 기준 타임프레임 (1D)
  updatedAt: string;       // 마지막 업데이트 시간
  rsi: RSIData;
  macd: MACDData;
}

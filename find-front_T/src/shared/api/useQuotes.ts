import { useQuery } from '@tanstack/react-query';
import { API_BASE_URL } from '../config/chart';

// 시세 데이터 타입
export interface QuoteItem {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  isUp: boolean;
}

export interface QuoteSummaryResponse {
  indices: QuoteItem[];
  forex: QuoteItem[];
  metals: QuoteItem[];
  energy: QuoteItem[];
}

export interface IndicatorSummary {
  rsi: {
    value: number;
    signal: 'oversold' | 'overbought' | 'neutral';
  };
  macd: {
    histogram: number;
    trend: 'bullish' | 'bearish' | 'neutral';
  };
}

export interface FearGreedData {
  value: number;
  classification: string;
  classificationKo: string;
}

export interface PerformanceData {
  period: string;
  value: number;
  startPrice: number;
  endPrice: number;
  startDate: string;
}

export interface PerformanceResponse {
  symbol: string;
  currentPrice: number;
  currentDate: string;
  performance: {
    '1W': PerformanceData;
    '1M': PerformanceData;
    '3M': PerformanceData;
    '6M': PerformanceData;
    'YTD': PerformanceData;
    '1Y': PerformanceData;
  };
}

export interface SeasonalDataPoint {
  date: string;
  dayOfYear: number;
  value: number;
}

export interface SeasonalYearData {
  year: number;
  startPrice: number;
  data: SeasonalDataPoint[];
}

export interface SeasonalResponse {
  symbol: string;
  years: SeasonalYearData[];
}

// 폴링 주기 (30초)
const POLLING_INTERVAL = 30 * 1000;

/**
 * 전체 시세 요약 조회 훅
 */
export function useQuoteSummary() {
  return useQuery({
    queryKey: ['quotes', 'summary'],
    queryFn: async (): Promise<QuoteSummaryResponse> => {
      const res = await fetch(`${API_BASE_URL}/api/quotes/summary`);
      if (!res.ok) throw new Error('Failed to fetch quote summary');
      const json = await res.json();
      return json.data || json;
    },
    refetchInterval: POLLING_INTERVAL,
    staleTime: POLLING_INTERVAL / 2,
  });
}

/**
 * 심볼의 RSI/MACD 지표 조회 훅
 */
export function useIndicatorSummary(symbol: string) {
  return useQuery({
    queryKey: ['indicators', symbol],
    queryFn: async (): Promise<IndicatorSummary> => {
      const res = await fetch(`${API_BASE_URL}/api/analysis/${encodeURIComponent(symbol)}/indicators`);
      if (!res.ok) throw new Error(`Failed to fetch indicators for ${symbol}`);
      const json = await res.json();
      return json;
    },
    refetchInterval: POLLING_INTERVAL,
    staleTime: POLLING_INTERVAL / 2,
    enabled: !!symbol,
  });
}

/**
 * 공포탐욕 지수 조회 훅
 */
export function useFearGreed(symbol: string) {
  const isCrypto = symbol.includes('BTC') || symbol.includes('ETH');
  const endpoint = isCrypto ? 'feargreed' : 'feargreed/stock';
  
  return useQuery({
    queryKey: ['feargreed', isCrypto ? 'crypto' : 'stock'],
    queryFn: async (): Promise<FearGreedData> => {
      const res = await fetch(`${API_BASE_URL}/api/analysis/${endpoint}`);
      if (!res.ok) throw new Error('Failed to fetch fear & greed index');
      const json = await res.json();
      return json;
    },
    refetchInterval: 5 * 60 * 1000,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * 퍼포먼스 데이터 조회 훅
 */
export function usePerformance(symbol: string) {
  return useQuery({
    queryKey: ['performance', symbol],
    queryFn: async (): Promise<PerformanceResponse> => {
      const res = await fetch(`${API_BASE_URL}/api/analysis/${encodeURIComponent(symbol)}/performance`);
      if (!res.ok) throw new Error(`Failed to fetch performance for ${symbol}`);
      const json = await res.json();
      return json;
    },
    refetchInterval: 5 * 60 * 1000,
    staleTime: 5 * 60 * 1000,
    enabled: !!symbol,
  });
}

/**
 * 시즌별(연도별) 차트 데이터 조회 훅
 */
export function useSeasonal(symbol: string, years: number = 3) {
  return useQuery({
    queryKey: ['seasonal', symbol, years],
    queryFn: async (): Promise<SeasonalResponse> => {
      const res = await fetch(`${API_BASE_URL}/api/analysis/${encodeURIComponent(symbol)}/seasonal?years=${years}`);
      if (!res.ok) throw new Error(`Failed to fetch seasonal data for ${symbol}`);
      const json = await res.json();
      return json;
    },
    refetchInterval: 10 * 60 * 1000,
    staleTime: 10 * 60 * 1000,
    enabled: !!symbol,
  });
}

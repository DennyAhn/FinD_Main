// API 설정
export const API_BASE_URL = import.meta.env.VITE_CHART_API_URL || 'http://localhost:8080';

// 타임프레임 설정 (분 단위)
export const TIMEFRAME_MINUTES: Record<string, number> = {
  '1m': 1,
  '5m': 5,
  '15m': 15,
  '1h': 60,
  '4h': 240,
};

// 분봉 타임프레임
export const MINUTE_TIMEFRAMES = Object.keys(TIMEFRAME_MINUTES);

// 일봉/주봉/월봉 타임프레임
export const PERIOD_TIMEFRAMES = ['1D', '1W', '1M'] as const;
export type PeriodTimeframe = typeof PERIOD_TIMEFRAMES[number];

// 전체 타임프레임 (하위 호환)
export const TIMEFRAMES = [...MINUTE_TIMEFRAMES, ...PERIOD_TIMEFRAMES];

// 심볼 목록
export const SYMBOLS = ['BTC/USD', 'SPY', 'QQQ', 'DIA'];

// 차트 크기
export const CHART_HEIGHT = 300;
export const VOLUME_CHART_HEIGHT = 100;

// 차트 색상
export const UP_COLOR = '#26a69a';
export const DOWN_COLOR = '#ef5350';

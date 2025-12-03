// 인기 기업 티커 목록
export const POPULAR_TICKERS = ['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'META'] as const

// 증시별 대표 기업 티커
export const NASDAQ_TICKERS = [
  'AAPL', 'MSFT', 'NVDA', 'GOOGL', 'META', 'AMZN', 'TSLA', 'AVGO', 'NFLX', 'AMD',
  'ADBE', 'CSCO', 'INTC', 'CMCSA', 'PEP', 'COST', 'PYPL', 'QCOM', 'TXN', 'INTU'
] as const

export const DOW_TICKERS = [
  'AAPL', 'MSFT', 'UNH', 'GS', 'HD', 'MCD', 'CAT', 'V', 'BA', 'AXP',
  'JPM', 'JNJ', 'TRV', 'CRM', 'IBM', 'CVX', 'DIS', 'NKE', 'MMM', 'WMT'
] as const

export const SP500_TICKERS = [
  'AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'META', 'BRK.B', 'TSLA', 'LLY', 'V',
  'JPM', 'UNH', 'XOM', 'MA', 'AVGO', 'JNJ', 'PG', 'HD', 'COST', 'NFLX'
] as const

// 기업 상세 페이지 탭 (증권사 스타일)
export const COMPANY_DETAIL_TABS = [
  { id: 'overview', label: '개요' },
  { id: 'chart', label: '차트' },
  { id: 'financials', label: '재무제표' },
  { id: 'news', label: '뉴스' },
  { id: 'analysis', label: '투자의견' },
] as const


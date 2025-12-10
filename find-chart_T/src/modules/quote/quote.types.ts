// Quote 관련 타입 정의

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
  indices: QuoteItem[];   // 주요증시 (QQQ, SPY, DIA, BTC/USD)
  forex: QuoteItem[];     // 환율
  metals: QuoteItem[];    // 금속
  energy: QuoteItem[];    // 에너지
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

// 심볼별 메타데이터
export interface SymbolMeta {
  symbol: string;
  name: string;
  category: 'stock' | 'crypto' | 'forex' | 'metals' | 'energy' | 'corp';
}

// 심볼 메타데이터 정의
export const SYMBOL_META: Record<string, SymbolMeta> = {
  // 주요 증시 (stock)
  'QQQ': { symbol: 'QQQ', name: 'NASDAQ 100', category: 'stock' },
  'SPY': { symbol: 'SPY', name: 'S&P 500', category: 'stock' },
  'DIA': { symbol: 'DIA', name: 'Dow Jones', category: 'stock' },
  
  // 암호화폐 (crypto)
  'BTC/USD': { symbol: 'BTC/USD', name: 'Bitcoin', category: 'crypto' },
  
  // 환율 (forex) - Candle1m 테이블에 시딩된 심볼
  'USD/KRW': { symbol: 'USD/KRW', name: '달러/원', category: 'forex' },
  'EUR/KRW': { symbol: 'EUR/KRW', name: '유로/원', category: 'forex' },
  'JPY/KRW': { symbol: 'JPY/KRW', name: '엔/원', category: 'forex' },
  'CNY/KRW': { symbol: 'CNY/KRW', name: '위안/원', category: 'forex' },
  'HKD/KRW': { symbol: 'HKD/KRW', name: '홍콩달러/원', category: 'forex' },
  
  // 금속 (metals)
  'XAU/USD': { symbol: 'XAU/USD', name: '금', category: 'metals' },
  'XAG/USD': { symbol: 'XAG/USD', name: '은', category: 'metals' },
  'XPT/USD': { symbol: 'XPT/USD', name: '백금', category: 'metals' },
  'XPD/USD': { symbol: 'XPD/USD', name: '팔라듐', category: 'metals' },
  'CPER': { symbol: 'CPER', name: '구리 ETF', category: 'metals' },
  
  // 에너지 (energy)
  'USO': { symbol: 'USO', name: 'WTI 원유', category: 'energy' },
  'BNO': { symbol: 'BNO', name: '브렌트 원유', category: 'energy' },
  'UNG': { symbol: 'UNG', name: '천연가스', category: 'energy' },
  'UGA': { symbol: 'UGA', name: '가솔린', category: 'energy' },
  'DBE': { symbol: 'DBE', name: '에너지 펀드', category: 'energy' },

  // 기업 (corp)
/*  'AAPL': {symbol: 'AAPL', name: '애플', category: 'corp' },
  'AMZN': {symbol: 'AMZN', name: '아마존', category: 'corp' },
  'AVGO': {symbol: 'AVGO', name: '브로드컴', category: 'corp' },
  'COST': {symbol: 'COST', name: '코스트코', category: 'corp' },
  'GOOGL': {symbol: 'GOOGL', name: '구글', category: 'corp' },
  'JNJ': {symbol: 'JNJ', name: '존슨앤드존슨', category: 'corp'},
  'JPM': {symbol: 'JPM', name: 'JP모건제이스', category: 'corp'},
  'LLY': {symbol: 'LLY', name: '릴리', category: 'corp'},
  'META': {symbol: 'META', name: '메타', category: 'corp'},
  'MRK': {symbol: 'MRK', name: '머크', category: 'corp'},
  'MSFT': {symbol: 'MSFT', name: '마이크로소프트', category: 'corp'},
  'NVDA': {symbol: 'NVDA', name: '엔비디아', category: 'corp'},
  'PG': {symbol: 'PG', name: 'P&G', category: 'corp'},
  'TSLA': {symbol: 'TSLA', name: '테슬라', category: 'corp'},
  'UNH': {symbol: 'UNH', name: '유나이티드헬스', category: 'corp'},
  'V': {symbol: 'V', name: '비자', category: 'corp'},
  'XOM': {symbol: 'XOM', name: '엑슨모빌', category: 'corp'}
*/
};

// 카테고리별 심볼 목록 (Candle1m 테이블 기준)
export const INDICES_SYMBOLS = ['QQQ', 'SPY', 'DIA', 'BTC/USD'];
export const FOREX_SYMBOLS = ['USD/KRW', 'EUR/KRW', 'JPY/KRW', 'CNY/KRW', 'HKD/KRW'];
export const METALS_SYMBOLS = ['XAU/USD', 'XAG/USD', 'XPT/USD', 'XPD/USD', 'CPER'];
export const ENERGY_SYMBOLS = ['USO', 'BNO', 'UNG', 'UGA', 'DBE'];
export const CORP_SYMBOLS = ['AAPL', 'AMZN', 'AVGO', 'COST', 'GOOGL', 'JNJ', 'JPM', 'LLY', 'META', 'MRK', 'MSFT', 'NVDA', 'PG', 'TSLA', 'UNH', 'V', 'XOM'];

// 티커 바에 표시할 심볼
export const TICKER_SYMBOLS = ['QQQ', 'SPY', 'DIA', 'BTC/USD', 'USO'];

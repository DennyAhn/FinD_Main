// Summary 모듈 타입 정의

export interface SymbolSummary {
  symbol: string;
  currentPrice: number | null;      // 현재가 (마지막 체결가)
  previousClose: number;            // 전일 종가
  previousCloseDate: string;        // 전일 날짜 (YYYY-MM-DD)
  change: number;                   // 변동액
  changePercent: number;            // 변동률 (%)
}

export interface SummaryResponse {
  symbol: string;
  previousClose: number;
  previousCloseDate: string;
}

export interface MultiSummaryResponse {
  data: SummaryResponse[];
}

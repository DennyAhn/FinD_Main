import { prisma } from '../../shared';
import {
  QuoteItem,
  QuoteSummaryResponse,
  TickerResponse,
  SYMBOL_META,
  INDICES_SYMBOLS,
  FOREX_SYMBOLS,
  METALS_SYMBOLS,
  ENERGY_SYMBOLS,
  TICKER_SYMBOLS,
} from './quote.types';

class QuoteService {
  /**
   * 심볼의 최신 시세 조회 (1분봉 기준 - 실시간 데이터)
   */
  private async getQuoteForSymbol(symbol: string): Promise<QuoteItem | null> {
    // 1분봉 테이블에서 가장 최근 2개 캔들 조회
    const candles = await prisma.candle1m.findMany({
      where: { symbol },
      orderBy: { time: 'desc' },
      take: 2,
    });

    if (candles.length === 0) return null;

    const latest = candles[0]!;
    const prev = candles[1];

    const price = latest.close;
    const prevClose = prev?.close ?? latest.open;
    const change = price - prevClose;
    const changePercent = prevClose !== 0 ? (change / prevClose) * 100 : 0;

    const meta = SYMBOL_META[symbol];

    return {
      symbol,
      name: meta?.name ?? symbol,
      price: Number(price.toFixed(2)),
      change: Number(change.toFixed(2)),
      changePercent: Number(changePercent.toFixed(2)),
      isUp: change >= 0,
      volume: latest.volume,
      updatedAt: latest.time.toISOString(),
    };
  }

  /**
   * 여러 심볼의 시세 조회
   * DB 연결 풀 고갈 방지를 위해 순차 처리
   */
  private async getQuotesForSymbols(symbols: string[]): Promise<QuoteItem[]> {
    const quotes: QuoteItem[] = [];
    for (const symbol of symbols) {
      const quote = await this.getQuoteForSymbol(symbol);
      if (quote) {
        quotes.push(quote);
      }
    }
    return quotes;
  }

  /**
   * 전체 시세 요약 조회
   */
  async getSummary(): Promise<QuoteSummaryResponse> {
    const [indices, forex, metals, energy] = await Promise.all([
      this.getQuotesForSymbols(INDICES_SYMBOLS),
      this.getQuotesForSymbols(FOREX_SYMBOLS),
      this.getQuotesForSymbols(METALS_SYMBOLS),
      this.getQuotesForSymbols(ENERGY_SYMBOLS),
    ]);

    return { indices, forex, metals, energy };
  }

  /**
   * 개별 심볼 시세 조회
   */
  async getQuote(symbol: string): Promise<QuoteItem | null> {
    return this.getQuoteForSymbol(symbol);
  }

  /**
   * 티커 바 데이터 조회
   */
  async getTicker(): Promise<TickerResponse> {
    const quotes = await this.getQuotesForSymbols(TICKER_SYMBOLS);

    return {
      items: quotes.map((q) => ({
        symbol: q.symbol,
        name: q.name,
        changePercent: q.changePercent,
        isUp: q.isUp,
      })),
    };
  }

  /**
   * 카테고리별 시세 조회
   */
  async getQuotesByCategory(category: string): Promise<QuoteItem[]> {
    let symbols: string[];

    switch (category) {
      case 'indices':
      case 'index':
      case 'stock':
        symbols = INDICES_SYMBOLS;
        break;
      case 'forex':
        symbols = FOREX_SYMBOLS;
        break;
      case 'metals':
        symbols = METALS_SYMBOLS;
        break;
      case 'energy':
        symbols = ENERGY_SYMBOLS;
        break;
      default:
        symbols = [];
    }

    return this.getQuotesForSymbols(symbols);
  }
}

export const quoteService = new QuoteService();

import { prisma } from '../../shared';
import { summaryRepository } from '../summary/summary.repository';
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
import pLimit from 'p-limit';

class QuoteService {
  /**
   * 심볼의 최신 시세 조회 (실시간 가격  전일 종가 비교)
   */
  private async getQuoteForSymbol(symbol: string): Promise<QuoteItem | null> {
    // 1분봉 테이블에서 가장 최근 1개 캔들 조회
    // 성능 최적화를 위해 최근 7일 데이터만 조회 (Out of shared memory 방지)
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const latestCandle = await prisma.candle1m.findFirst({
      where: { 
        symbol,
        time: { gte: oneWeekAgo }
      },
      orderBy: { time: 'desc' },
    });

    if (!latestCandle) return null;

    // 전일 종가를 구하기 위해 어제 날짜의 일봉을 조회
    const prevClose = await this.getPreviousClosePrice(symbol);

    const price = latestCandle.close;
    const change = price - prevClose;

    // 전일 종가가 0이거나 없을 경우(신규 상장 등) 변동률 0 처리
    const changePercent = prevClose !== 0 ? (change / prevClose) * 100 : 0;

    const meta = SYMBOL_META[symbol];

    return {
      symbol,
      name: meta?.name ?? symbol,
      price: Number(price.toFixed(2)),
      change: Number(change.toFixed(2)),
      changePercent: Number(changePercent.toFixed(2)),
      isUp: change >= 0,
      volume: latestCandle.volume,
      updatedAt: latestCandle.time.toISOString(),
    };
  }

  private async getPreviousClosePrice(symbol: string): Promise<number>{
    // UTC 기준 오늘 00:00:00
    const now = new Date();
    const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    // 성능 최적화를 위해 30일 전까지만 조회
    const thirtyDaysAgo = new Date(todayUTC);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // market.candle_1d 뷰에서 오늘 이전(bucket < todayUTC) 데이터 중 가장 최신 1개 조회
    const prevDailyCandles = await prisma.$queryRaw<Array<{ close: number}>>`
      SELECT close
      FROM market.candle_1d
      WHERE symbol = ${symbol}
        AND bucket < ${todayUTC}
        AND bucket >= ${thirtyDaysAgo}
      ORDER BY bucket DESC
      LIMIT 1
    `;

    return prevDailyCandles[0]?.close ?? 0;
  }

  /**
   * 여러 심볼의 시세 조회
   * DB 연결 풀 고갈 방지를 위해 순차 처리
   */
  private async getQuotesForSymbols(symbols: string[]): Promise<QuoteItem[]> {
    const limit = pLimit(2);

    const quotes = await Promise.all(
      symbols.map(symbol => 
        limit(() => this.getQuoteForSymbol(symbol))
      )
    );

    return quotes.filter((q): q is QuoteItem => q !== null)
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

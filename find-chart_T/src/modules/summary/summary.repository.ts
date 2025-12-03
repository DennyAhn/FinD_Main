import { prisma } from '../../shared';

export class SummaryRepository {
  /**
   * 특정 심볼의 가장 최근 일봉 조회 (전일 종가) - CA 뷰 사용
   */
  async getLatestDailyCandle(symbol: string) {
    const result = await prisma.$queryRaw<Array<{
      bucket: Date;
      symbol: string;
      open: number;
      high: number;
      low: number;
      close: number;
      volume: number;
    }>>` 
      SELECT bucket, symbol, open, high, low, close, volume
      FROM market.candle_1d
      WHERE symbol = ${symbol}
      ORDER BY bucket DESC
      LIMIT 1
    `;
    
    const candle = result[0];
    return candle ? {
      time: candle.bucket,
      symbol: candle.symbol,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: candle.volume,
    } : null;
  }

  /**
   * 여러 심볼의 가장 최근 일봉 조회 - CA 뷰 사용
   */
  async getLatestDailyCandlesForSymbols(symbols: string[]) {
    // 각 심볼별로 가장 최근 일봉을 가져옴
    const results = await Promise.all(
      symbols.map(async (symbol) => {
        return this.getLatestDailyCandle(symbol);
      })
    );

    return results.filter((r): r is NonNullable<typeof r> => r !== null);
  }

  /**
   * 특정 날짜의 일봉 조회 - CA 뷰 사용
   */
  async getDailyCandleByDate(symbol: string, date: Date) {
    const result = await prisma.$queryRaw<Array<{
      bucket: Date;
      symbol: string;
      open: number;
      high: number;
      low: number;
      close: number;
      volume: number;
    }>>` 
      SELECT bucket, symbol, open, high, low, close, volume
      FROM market.candle_1d
      WHERE symbol = ${symbol}
        AND bucket = ${date}
      LIMIT 1
    `;
    
    const candle = result[0];
    return candle ? {
      time: candle.bucket,
      symbol: candle.symbol,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: candle.volume,
    } : null;
  }

  /**
   * 일봉 데이터 존재 여부 확인 - CA 뷰 사용
   */
  async hasDailyData(symbol: string): Promise<boolean> {
    const result = await prisma.$queryRaw<Array<{ count: bigint }>>` 
      SELECT COUNT(*) as count
      FROM market.candle_1d
      WHERE symbol = ${symbol}
      LIMIT 1
    `;
    return Number(result[0]?.count ?? 0) > 0;
  }

  /**
   * 모든 심볼의 일봉 데이터 현황
   */
  async getDailyDataStatus() {
    const symbols = ['SPY', 'QQQ', 'DIA', 'BTC/USD'];
    const status = await Promise.all(
      symbols.map(async (symbol) => {
        const latest = await this.getLatestDailyCandle(symbol);
        return {
          symbol,
          hasData: !!latest,
          latestDate: latest?.time?.toISOString().split('T')[0] ?? null,
          latestClose: latest?.close ?? null,
        };
      })
    );
    return status;
  }
}

export const summaryRepository = new SummaryRepository();

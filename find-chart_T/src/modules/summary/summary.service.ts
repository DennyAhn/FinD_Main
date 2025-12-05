import { summaryRepository } from './summary.repository';
import { SummaryResponse, MultiSummaryResponse } from './summary.types';

export class SummaryService {
  /**
   * 단일 심볼의 전일 종가 정보 조회
   */
  async getSummary(symbol: string): Promise<SummaryResponse | null> {
    const dailyCandle = await summaryRepository.getLatestDailyCandle(symbol);

    if (!dailyCandle) {
      return null;
    }

    return {
      symbol,
      previousClose: dailyCandle.close,
      previousCloseDate: dailyCandle.time.toISOString().split('T')[0] ?? '',
    };
  }

  /**
   * 여러 심볼의 전일 종가 정보 일괄 조회
   */
  async getMultipleSummaries(symbols: string[]): Promise<MultiSummaryResponse> {
    const candles = await summaryRepository.getLatestDailyCandlesForSymbols(symbols);

    const data: SummaryResponse[] = candles.map((candle) => ({
      symbol: candle.symbol,
      previousClose: candle.close,
      previousCloseDate: candle.time.toISOString().split('T')[0] ?? '',
    }));

    return { data };
  }

  /**
   * 일봉 데이터 상태 확인 (디버깅/관리용)
   */
  async getDataStatus() {
    return summaryRepository.getDailyDataStatus();
  }
}

export const summaryService = new SummaryService();

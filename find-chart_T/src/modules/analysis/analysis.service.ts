import { candleService } from '../candle';
import { prisma } from '../../shared';
import {
  IndicatorResult,
  MACDResult,
  BollingerBandsResult,
  AnalysisResponse,
  PerformancePeriod,
  PerformanceData,
  PerformanceResponse,
  SeasonalYearData,
  SeasonalResponse,
  IndicatorSummary,
  RSIData,
  MACDData,
} from './analysis.types';
import {
  calculateRSI,
  calculateMACD,
  calculateBollingerBands,
  calculateSMA,
  calculateEMA,
} from './indicators';

export class AnalysisService {
  /**
   * RSI 계산
   */
  async getRSI(
    symbol: string,
    timeframe: string,
    period: number = 14,
    limit: number = 100
  ): Promise<AnalysisResponse<IndicatorResult>> {
    // 캔들 데이터 가져오기 (RSI 계산에 필요한 추가 데이터 확보)
    const candleData = await candleService.getCandles(symbol, timeframe, {
      limit: limit + period + 1,
    });

    const closes = candleData.data.map(c => c.close);
    const times = candleData.data.map(c => c.time);

    const rsiValues = calculateRSI(closes, { period });

    // time 매핑: 라이브러리 결과는 뒤에서부터 매칭
    // 예: closes 100개, period 14 → rsiValues 86개
    // times[14]~times[99]와 rsiValues[0]~rsiValues[85] 매핑
    const startIndex = times.length - rsiValues.length;
    const data = rsiValues.map((r, i) => ({
      ...r,
      time: times[startIndex + i] ?? 0,
    }));

    // 요청한 limit만큼만 반환
    return {
      symbol,
      timeframe,
      indicator: 'RSI',
      params: { period },
      data: data.slice(-limit),
    };
  }

  /**
   * MACD 계산
   */
  async getMACD(
    symbol: string,
    timeframe: string,
    fastPeriod: number = 12,
    slowPeriod: number = 26,
    signalPeriod: number = 9,
    limit: number = 100
  ): Promise<AnalysisResponse<MACDResult>> {
    const requiredCandles = limit + slowPeriod + signalPeriod;
    const candleData = await candleService.getCandles(symbol, timeframe, {
      limit: requiredCandles,
    });

    const closes = candleData.data.map(c => c.close);
    const times = candleData.data.map(c => c.time);

    const macdValues = calculateMACD(closes, { fastPeriod, slowPeriod, signalPeriod });

    // time 매핑: 라이브러리 결과는 뒤에서부터 매칭
    const startIndex = times.length - macdValues.length;
    const data = macdValues.map((m, i) => ({
      ...m,
      time: times[startIndex + i] ?? 0,
    }));

    return {
      symbol,
      timeframe,
      indicator: 'MACD',
      params: { fastPeriod, slowPeriod, signalPeriod },
      data: data.slice(-limit),
    };
  }

  /**
   * Bollinger Bands 계산
   */
  async getBollingerBands(
    symbol: string,
    timeframe: string,
    period: number = 20,
    stdDev: number = 2,
    limit: number = 100
  ): Promise<AnalysisResponse<BollingerBandsResult>> {
    const candleData = await candleService.getCandles(symbol, timeframe, {
      limit: limit + period,
    });

    const closes = candleData.data.map(c => c.close);
    const times = candleData.data.map(c => c.time);

    const bbValues = calculateBollingerBands(closes, { period, stdDev });

    // time 매핑: 라이브러리 결과는 뒤에서부터 매칭
    const startIndex = times.length - bbValues.length;
    const data = bbValues.map((b, i) => ({
      ...b,
      time: times[startIndex + i] ?? 0,
    }));

    return {
      symbol,
      timeframe,
      indicator: 'BollingerBands',
      params: { period, stdDev },
      data: data.slice(-limit),
    };
  }

  /**
   * SMA 계산
   */
  async getSMA(
    symbol: string,
    timeframe: string,
    period: number,
    limit: number = 100
  ): Promise<AnalysisResponse<IndicatorResult>> {
    const candleData = await candleService.getCandles(symbol, timeframe, {
      limit: limit + period,
    });

    const closes = candleData.data.map(c => c.close);
    const times = candleData.data.map(c => c.time);

    const smaValues = calculateSMA(closes, { period });

    // time 매핑: 라이브러리 결과는 뒤에서부터 매칭
    const startIndex = times.length - smaValues.length;
    const data = smaValues.map((s, i) => ({
      ...s,
      time: times[startIndex + i] ?? 0,
    }));

    return {
      symbol,
      timeframe,
      indicator: 'SMA',
      params: { period },
      data: data.slice(-limit),
    };
  }

  /**
   * EMA 계산
   */
  async getEMA(
    symbol: string,
    timeframe: string,
    period: number,
    limit: number = 100
  ): Promise<AnalysisResponse<IndicatorResult>> {
    const candleData = await candleService.getCandles(symbol, timeframe, {
      limit: limit + period,
    });

    const closes = candleData.data.map(c => c.close);
    const times = candleData.data.map(c => c.time);

    const emaValues = calculateEMA(closes, { period });

    // time 매핑: 라이브러리 결과는 뒤에서부터 매칭
    const startIndex = times.length - emaValues.length;
    const data = emaValues.map((e, i) => ({
      ...e,
      time: times[startIndex + i] ?? 0,
    }));

    return {
      symbol,
      timeframe,
      indicator: 'EMA',
      params: { period },
      data: data.slice(-limit),
    };
  }

  // ==================== Performance (성과) ====================

  /**
   * 특정 기간 동안의 성과(변동률)를 계산
   * 최적화: 7번의 쿼리를 1번의 쿼리로 통합
   */
  async getPerformance(symbol: string): Promise<PerformanceResponse> {
    const today = new Date();
    
    // 각 기간별 시작 날짜 계산
    const periodDates: Record<PerformancePeriod, Date> = {
      '1W': this.subtractDays(today, 7),
      '1M': this.subtractMonths(today, 1),
      '3M': this.subtractMonths(today, 3),
      '6M': this.subtractMonths(today, 6),
      'YTD': new Date(today.getFullYear(), 0, 1), // 올해 1월 1일
      '1Y': this.subtractYears(today, 1),
    };

    // 가장 오래된 날짜 찾기 (1Y)
    const minDate = periodDates['1Y'];

    // 한 번의 쿼리로 필요한 모든 일봉 데이터 조회
    const candles = await prisma.$queryRaw<Array<{
      bucket: Date;
      close: number;
    }>>` 
      SELECT bucket, close
      FROM market.candle_1d
      WHERE symbol = ${symbol}
        AND bucket >= ${minDate}
      ORDER BY bucket ASC
    `;

    if (candles.length === 0) {
      throw new Error(`No daily candle data found for symbol: ${symbol}`);
    }

    // 가장 최근 캔들을 현재가로 사용
    const latestCandle = candles[candles.length - 1];
    if (!latestCandle) {
        throw new Error(`No daily candle data found for symbol: ${symbol}`);
    }
    const currentPrice = latestCandle.close;
    const currentDate = latestCandle.bucket.toISOString().split('T')[0] ?? '';

    // 메모리 상에서 각 기간별 성과 계산
    const performanceEntries = (Object.entries(periodDates) as [PerformancePeriod, Date][]).map(([period, startDate]) => {
      // 해당 기간의 시작일 이후 첫 번째 캔들 찾기
      const startCandle = candles.find(c => c.bucket >= startDate);
      
      let periodData: PerformanceData;

      if (!startCandle) {
        periodData = {
          period,
          value: null,
          startPrice: null,
          endPrice: currentPrice,
          startDate: null,
        };
      } else {
        const candleStartPrice = startCandle.close;
        const value = ((currentPrice - candleStartPrice) / candleStartPrice) * 100;
        const candleDate = startCandle.bucket.toISOString().split('T')[0] ?? null;

        periodData = {
          period,
          value: Math.round(value * 100) / 100, // 소수점 2자리
          startPrice: candleStartPrice,
          endPrice: currentPrice,
          startDate: candleDate,
        };
      }
      
      return [period, periodData] as const;
    });

    // Record 타입으로 변환
    const performance = Object.fromEntries(performanceEntries) as Record<PerformancePeriod, PerformanceData>;

    return {
      symbol,
      currentPrice,
      currentDate,
      performance,
    };
  }

  /**
   * 특정 기간의 성과 데이터 계산 (Deprecated: getPerformance 내부 로직으로 통합됨)
   */
  private async calculatePeriodPerformance(
    symbol: string,
    period: PerformancePeriod,
    startDate: Date,
    currentPrice: number
  ): Promise<PerformanceData> {
    // ... existing code ...
    return {
        period,
        value: 0,
        startPrice: 0,
        endPrice: 0,
        startDate: null
    };
  }

  // ==================== Seasonal (시즌별) ====================

  // 주식 심볼 (주말 제외 필요)
  private readonly STOCK_SYMBOLS = ['SPY', 'QQQ', 'DIA'];

  /**
   * 연도별 시즌 차트 데이터 생성 (최근 N년)
   * 최적화: N번의 쿼리를 1번의 쿼리로 통합
   */
  async getSeasonal(symbol: string, years: number = 3): Promise<SeasonalResponse> {
    const currentYear = new Date().getFullYear();
    const startYear = currentYear - years + 1;
    const startDate = new Date(startYear, 0, 1); // 시작 연도 1월 1일

    // 한 번의 쿼리로 필요한 모든 연도의 데이터 조회
    const allCandles = await prisma.$queryRaw<Array<{
      bucket: Date;
      close: number;
    }>>` 
      SELECT bucket, close
      FROM market.candle_1d
      WHERE symbol = ${symbol}
        AND bucket >= ${startDate}
      ORDER BY bucket ASC
    `;

    const yearlyData: SeasonalYearData[] = [];
    const targetYears = Array.from({ length: years }, (_, i) => currentYear - i).reverse();

    for (const year of targetYears) {
      // 메모리 상에서 연도별 필터링
      const yearStart = new Date(year, 0, 1);
      const yearEnd = new Date(year, 11, 31, 23, 59, 59);
      
      const yearCandles = allCandles.filter(c => 
        c.bucket >= yearStart && c.bucket <= yearEnd
      );

      if (yearCandles.length > 0) {
        const yearData = this.processYearSeasonal(symbol, year, yearCandles);
        if (yearData) {
          yearlyData.push(yearData);
        }
      }
    }

    return {
      symbol,
      years: yearlyData,
    };
  }

  /**
   * 특정 연도의 시즌 데이터 처리 (메모리 연산)
   */
  private processYearSeasonal(
    symbol: string,
    year: number,
    candles: Array<{ bucket: Date; close: number }>
  ): SeasonalYearData | null {
    if (candles.length === 0) {
      return null;
    }

    // 연초 기준 가격 (첫 번째 캔들의 종가)
    const firstCandle = candles[0];
    if (!firstCandle) {
        return null;
    }
    const startPrice = firstCandle.close;

    const isStock = this.STOCK_SYMBOLS.includes(symbol);

    const data = candles.map((candle, index) => {
      const date = candle.bucket;
      // 주식: 거래일 번호 (0부터 시작, 연간 약 252일)
      // 암호화폐: 달력일 (1~365)
      const dayOfYear = isStock 
        ? this.tradingDayToCalendarDay(index, candles.length)
        : this.getDayOfYear(date);
      
      const value = ((candle.close - startPrice) / startPrice) * 100;
      const dateStr = date.toISOString().split('T')[0] ?? '';

      return {
        date: dateStr,
        dayOfYear,
        value: Math.round(value * 100) / 100,
      };
    });

    return {
      year,
      startPrice,
      data,
    };
  }

  /**
   * 특정 연도의 시즌 데이터 계산 (Deprecated: processYearSeasonal로 대체됨)
   */
  private async calculateYearSeasonal(
    symbol: string,
    year: number
  ): Promise<SeasonalYearData | null> {
     return null;
  }

  // ==================== 유틸리티 함수 ====================

  /**
   * 거래일 인덱스를 달력일(1~365)로 균등 변환
   * 연간 거래일 ~252일을 365일로 스케일링
   */
  private tradingDayToCalendarDay(tradingDayIndex: number, totalTradingDays: number): number {
    // 연간 거래일 기준으로 365일에 균등 분배
    const estimatedYearlyTradingDays = Math.max(totalTradingDays, 252);
    return Math.round((tradingDayIndex / estimatedYearlyTradingDays) * 365) + 1;
  }

  private subtractDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() - days);
    return result;
  }

  private subtractMonths(date: Date, months: number): Date {
    const result = new Date(date);
    result.setMonth(result.getMonth() - months);
    return result;
  }

  private subtractYears(date: Date, years: number): Date {
    const result = new Date(date);
    result.setFullYear(result.getFullYear() - years);
    return result;
  }

  private getDayOfYear(date: Date): number {
    const start = new Date(date.getFullYear(), 0, 0);
    const diff = date.getTime() - start.getTime();
    const oneDay = 1000 * 60 * 60 * 24;
    return Math.floor(diff / oneDay);
  }

  // ==================== Dashboard Indicators (대시보드용 지표) ====================

  /**
   * 대시보드용 RSI/MACD 요약 데이터
   * - 일봉 데이터 사용 (효율적)
   * - 오늘 데이터는 1분봉 최신가로 대체 (실시간)
   * - MACD는 가격 대비 %로 정규화
   */
  async getIndicatorSummary(symbol: string): Promise<IndicatorSummary> {
    // 1. 일봉 데이터 조회 (MACD 계산에 35일 필요) - CA 뷰 사용
    const requiredDays = 40; // 여유있게
    const dailyCandles = await prisma.$queryRaw<Array<{
      bucket: Date;
      close: number;
    }>>` 
      SELECT bucket as time, close
      FROM market.candle_1d
      WHERE symbol = ${symbol}
      ORDER BY bucket DESC
      LIMIT ${requiredDays}
    `;

    if (dailyCandles.length < 35) {
      throw new Error(`Insufficient daily data for ${symbol}`);
    }

    // 2. 1분봉에서 오늘 최신 종가 조회
    const latest1mCandle = await prisma.candle1m.findFirst({
      where: { symbol },
      orderBy: { time: 'desc' },
      select: { time: true, close: true },
    });

    // 3. 오늘 날짜인지 확인하고 대체
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let closes: number[] = [];
    const dailyReversed = [...dailyCandles].reverse(); // 오래된 순으로 정렬
    
    for (const candle of dailyReversed) {
      // CA 뷰는 bucket 컬럼 사용
      const candleDate = new Date(candle.bucket);
      candleDate.setHours(0, 0, 0, 0);
      
      // 오늘 일봉은 1분봉 최신가로 대체
      if (candleDate.getTime() === today.getTime() && latest1mCandle) {
        closes.push(latest1mCandle.close);
      } else {
        closes.push(candle.close);
      }
    }

    // 현재 가격 (정규화용)
    const currentPrice = latest1mCandle?.close ?? closes[closes.length - 1] ?? 1;

    // 4. RSI 계산 (14일)
    const rsiPeriod = 14;
    const rsiValues = calculateRSI(closes, { period: rsiPeriod });
    const latestRSI = rsiValues[rsiValues.length - 1];
    
    const rsiValue = latestRSI?.value ?? 50;
    const rsiSignal: RSIData['signal'] = 
      rsiValue <= 30 ? 'oversold' : 
      rsiValue >= 70 ? 'overbought' : 'neutral';

    const rsiData: RSIData = {
      value: Math.round(rsiValue * 100) / 100,
      signal: rsiSignal,
      period: rsiPeriod,
    };

    // 5. MACD 계산 (12, 26, 9)
    const macdValues = calculateMACD(closes, { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 });
    const latestMACD = macdValues[macdValues.length - 1];

    const macdValue = latestMACD?.macd ?? 0;
    const signalValue = latestMACD?.signal ?? 0;
    const histogramValue = latestMACD?.histogram ?? 0;
    
    // MACD를 가격 대비 %로 정규화
    const normalizedMacd = (macdValue / currentPrice) * 100;
    const normalizedSignal = (signalValue / currentPrice) * 100;
    const normalizedHistogram = (histogramValue / currentPrice) * 100;
    
    // 추세 판단: 정규화된 히스토그램 기준
    const macdTrend: MACDData['trend'] = 
      normalizedHistogram > 0.01 ? 'bullish' :
      normalizedHistogram < -0.01 ? 'bearish' : 'neutral';

    const macdData: MACDData = {
      macd: Math.round(normalizedMacd * 100) / 100,
      signal: Math.round(normalizedSignal * 100) / 100,
      histogram: Math.round(normalizedHistogram * 100) / 100,
      trend: macdTrend,
    };

    return {
      symbol,
      timeframe: '1D',
      updatedAt: new Date().toISOString(),
      rsi: rsiData,
      macd: macdData,
    };
  }

  /**
   * 여러 심볼의 지표 요약 조회
   * DB 연결 풀 고갈 방지를 위해 순차 처리
   */
  async getIndicatorSummaryBatch(symbols: string[]): Promise<IndicatorSummary[]> {
    const results: IndicatorSummary[] = [];
    for (const symbol of symbols) {
      try {
        const summary = await this.getIndicatorSummary(symbol);
        results.push(summary);
      } catch (error) {
        // 개별 실패는 무시
      }
    }
    return results;
  }
}

export const analysisService = new AnalysisService();

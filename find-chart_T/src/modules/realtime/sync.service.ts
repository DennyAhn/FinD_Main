/**
 * Sync Service - 서버 시작 시 데이터 정합성 검사 및 백필
 * 
 * 서버가 꺼져 있던 동안의 데이터 누락을 자동으로 복구합니다.
 * - Rate Limiter(Bottleneck) 적용으로 API 제한 준수
 * - TimescaleDB Continuous Aggregates 사용으로 상위 타임프레임 집계 불필요
 */

import axios from 'axios';
import config from '../../config';
import { candleRepository } from '../candle';
import { logger } from '../../shared/utils/logger';
import { twelveDataLimiter } from '../../shared/utils/rate-limiter';
import { candleService } from '../candle';
import { SYMBOL_META } from '../quote/quote.types';
import pLimit from 'p-limit';

const SYMBOLS = config.STREAM_SYMBOLS;

// TwelveData API 응답 타입
interface TwelveDataTimeSeriesResponse {
  status?: string;
  message?: string;
  values?: TwelveDataCandle[];
}

interface TwelveDataCandle {
  datetime: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
}

/**
 * 서버 시작 시 데이터 정합성 검사 및 백필
 */
export async function syncMissingData(): Promise<void> {
  logger.info('Starting data sync check...');

  const limit = pLimit(2);

  const tasks = SYMBOLS.map(symbol =>
    limit(() => syncSymbol(symbol))
  );

  await Promise.all(tasks);

  logger.info('Data sync completed. Ready for realtime streaming.');
}

async function syncSymbol(symbol: string): Promise<void> {
  try {
    // DB에서 마지막 2개 1분봉 조회 (Race Condition 및 중간 갭 감지용)
    const lastCandles = await candleRepository.getLastCandles(symbol, 2);

    if (lastCandles.length === 0) {
      logger.info('No existing data (new symbol). Initial seeding required.', { symbol });
      return;
    }

    const now = new Date();
    const latestCandle = lastCandles[0]!;
    
    // 1. 마지막 캔들 이후의 갭 체크 (일반적인 다운타임 복구)
    await checkAndFillGap(symbol, latestCandle.time, now);

    // 2. 마지막 캔들 직전의 갭 체크 (Race Condition 복구)
    // 서버 재시작 직후 웹소켓으로 1개가 들어왔지만, 그 전에 긴 다운타임이 있었던 경우
    if (lastCandles.length === 2) {
      const prevCandle = lastCandles[1]!;
      const gapMinutes = (latestCandle.time.getTime() - prevCandle.time.getTime()) / (1000 * 60);
      
      // 1분봉이므로 2분 이상 차이나면 갭으로 간주
      if (gapMinutes > 2) {
        logger.warn('Gap detected BEFORE the latest candle (Race Condition recovery)', {
          symbol,
          prevTime: prevCandle.time.toISOString(),
          latestTime: latestCandle.time.toISOString(),
          gapMinutes: Math.floor(gapMinutes)
        });
        // latestCandle.time은 이미 존재하므로, 그 전까지만 채움
        await checkAndFillGap(symbol, prevCandle.time, latestCandle.time);
      }
    }

  } catch (error) {
    logger.error('Sync failed for symbol', { symbol, error });
  }
}

async function checkAndFillGap(symbol: string, startTime: Date, endTime: Date): Promise<void> {
  const diffMinutes = (endTime.getTime() - startTime.getTime()) / (1000 * 60);

  // 2분 미만 갭은 무시
  if (diffMinutes < 2) {
    return;
  }

  logger.info('Data gap detected, starting recovery...', { 
    symbol, 
    start: startTime.toISOString(),
    end: endTime.toISOString(),
    gapMinutes: Math.floor(diffMinutes) 
  });

  // TwelveData Time Series API 호출
  const apiStartDate = new Date(startTime.getTime() + 60000); // 시작 + 1분
  
  // API 호출 시 end_date가 미래면 현재 시간으로 조정 (API 에러 방지)
  const now = new Date();
  const apiEndDate = endTime > now ? now : endTime;

  if (apiStartDate >= apiEndDate) return;

  const response = await twelveDataLimiter.schedule(() =>
    axios.get<TwelveDataTimeSeriesResponse>('https://api.twelvedata.com/time_series', {
      params: {
        symbol,
        interval: '1min',
        apikey: config.TWELVE_DATA_API_KEY,
        start_date: apiStartDate.toISOString(),
        end_date: apiEndDate.toISOString(),
        outputsize: 5000,
        order: 'ASC',
      },
    })
  );

  if (response.data.status === 'error') {
    logger.error('TwelveData API error during sync', { 
      symbol, 
      message: response.data.message 
    });
    return;
  }

  const candles = response.data.values;
  if (!candles || candles.length === 0) {
    logger.info('No data to recover for period', { symbol });
    return;
  }

  // 1분봉 벌크 저장
  const category = SYMBOL_META[symbol]?.category ?? 'stock';
  
  const count = await candleRepository.bulkSave1mCandles(
    candles.map((c: TwelveDataCandle) => ({
      symbol,
      time: new Date(c.datetime),
      open: parseFloat(c.open),
      high: parseFloat(c.high),
      low: parseFloat(c.low),
      close: parseFloat(c.close),
      volume: parseInt(c.volume) || 0,
      category,
    }))
  );

  logger.info('Candles recovered successfully', { symbol, count });

  await candleService.refreshAllContinuousAggregates(
    Math.floor(apiStartDate.getTime() / 1000)
  );
  logger.info('Continuous Aggregates refreshed for recovery period', { symbol });
}

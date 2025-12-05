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

  for (const symbol of SYMBOLS) {
    await syncSymbol(symbol);
  }

  logger.info('Data sync completed. Ready for realtime streaming.');
}

async function syncSymbol(symbol: string): Promise<void> {
  try {
    // DB에서 마지막 1분봉 조회
    const lastCandle = await candleRepository.getLast1mCandle(symbol);

    if (!lastCandle) {
      logger.info('No existing data (new symbol). Initial seeding required.', { symbol });
      return;
    }

    const lastTime = lastCandle.time;
    const now = new Date();
    const diffMinutes = (now.getTime() - lastTime.getTime()) / (1000 * 60);

    // 2분 미만 갭은 무시 (실시간 수신으로 커버 가능)
    if (diffMinutes < 2) {
      logger.debug('Data is up to date', { symbol });
      return;
    }

    logger.info('Data gap detected, starting recovery...', { 
      symbol, 
      gapMinutes: Math.floor(diffMinutes) 
    });

    // TwelveData Time Series API 호출 (Rate Limiter 적용)
    const startDate = new Date(lastTime.getTime() + 60000); // 마지막 + 1분
    
    const response = await twelveDataLimiter.schedule(() =>
      axios.get<TwelveDataTimeSeriesResponse>('https://api.twelvedata.com/time_series', {
        params: {
          symbol,
          interval: '1min',
          apikey: config.TWELVE_DATA_API_KEY,
          start_date: startDate.toISOString(),
          end_date: now.toISOString(),
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
      logger.info('No data to recover (market closed, etc.)', { symbol });
      return;
    }

    // 1분봉 벌크 저장 (Buffer 거치지 않고 바로 DB로)
    const count = await candleRepository.bulkSave1mCandles(
      candles.map((c: TwelveDataCandle) => ({
        symbol,
        time: new Date(c.datetime),
        open: parseFloat(c.open),
        high: parseFloat(c.high),
        low: parseFloat(c.low),
        close: parseFloat(c.close),
        volume: parseInt(c.volume) || 0,
      }))
    );

    logger.info('Candles recovered successfully', { symbol, count });

    // ⚠️ 상위 타임프레임 집계는 TimescaleDB Continuous Aggregates가 자동 처리
    // 애플리케이션 레벨에서 집계하지 않음

  } catch (error) {
    logger.error('Sync failed for symbol', { symbol, error });
  }
}

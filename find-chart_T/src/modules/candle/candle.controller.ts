import { Request, Response } from 'express';
import { candleService } from './candle.service';
import { parseTimeframe } from './candle.constants';
import { toEpochSec } from '../../shared';
import { 
  GetCandlesParams, 
  GetCandlesQuery
} from './candle.types';

export class CandleController {
  /**
   * GET /api/candles/:symbol/:timeframe
   */
  async getCandles(
    req: Request<GetCandlesParams, unknown, unknown, GetCandlesQuery>,
    res: Response
  ): Promise<void> {
    const { symbol, timeframe } = req.params;
    const limit = parseInt(req.query.limit ?? '1000', 10);
    const from = toEpochSec(req.query.from);
    const to = toEpochSec(req.query.to);

    const result = await candleService.getCandles(symbol, timeframe, {
      limit,
      from,
      to,
    });

    res.status(200).json(result);
  }

  /**
   * POST /api/aggregate/refresh
   * 
   * TimescaleDB Continuous Aggregate 뷰를 수동으로 새로고침합니다.
   * 1분봉 데이터를 백필한 후 상위 타임프레임에 즉시 반영하기 위해 사용합니다.
   * 
   * 요청 예시:
   * {
   *   "timeframe": "5m",  // 5m, 15m, 1h, 4h, 1D, 1W, 1M
   *   "from": 1638316800, // 선택적
   *   "to": 1638403200    // 선택적
   * }
   */
  async refreshAggregation(
    req: Request<unknown, unknown, { timeframe: string; from?: string | number; to?: string | number }>,
    res: Response
  ): Promise<void> {
    const { timeframe, from, to } = req.body;

    if (!timeframe) {
      res.status(400).json({ error: 'timeframe이 필요합니다.' });
      return;
    }

    const startEpochSec = toEpochSec(from);
    const endEpochSec = toEpochSec(to);

    await candleService.refreshContinuousAggregate(
      timeframe,
      startEpochSec,
      endEpochSec
    );

    res.status(200).json({
      success: true,
      timeframe,
      message: 'Continuous Aggregate 뷰가 새로고침되었습니다.',
    });
  }
}

export const candleController = new CandleController();

import { Router } from 'express';
import { analysisController } from './analysis.controller';
import { asyncHandler } from '../../shared';

const router = Router();

// ==================== Dashboard Indicators ====================
// 주의: 이 라우트들은 :symbol/:timeframe 라우트보다 먼저 정의해야 함

// GET /api/analysis/indicators/batch?symbols=QQQ,SPY,DIA
router.get(
  '/indicators/batch',
  asyncHandler((req, res) => analysisController.getIndicatorSummaryBatch(req as any, res))
);

// GET /api/analysis/feargreed?days=7
router.get(
  '/feargreed',
  asyncHandler((req, res) => analysisController.getFearGreed(req as any, res))
);

// GET /api/analysis/feargreed/stock - 주식 시장용 (CNN)
router.get(
  '/feargreed/stock',
  asyncHandler((req, res) => analysisController.getStockFearGreed(req as any, res))
);

// ==================== Performance & Seasonal ====================

// GET /api/analysis/:symbol/performance
router.get(
  '/:symbol/performance',
  asyncHandler((req, res) => analysisController.getPerformance(req as any, res))
);

// GET /api/analysis/:symbol/seasonal
router.get(
  '/:symbol/seasonal',
  asyncHandler((req, res) => analysisController.getSeasonal(req as any, res))
);

// GET /api/analysis/:symbol/indicators
router.get(
  '/:symbol/indicators',
  asyncHandler((req, res) => analysisController.getIndicatorSummary(req as any, res))
);

// ==================== Technical Indicators ====================

// GET /api/analysis/:symbol/:timeframe/rsi
router.get(
  '/:symbol/:timeframe/rsi',
  asyncHandler((req, res) => analysisController.getRSI(req as any, res))
);

// GET /api/analysis/:symbol/:timeframe/macd
router.get(
  '/:symbol/:timeframe/macd',
  asyncHandler((req, res) => analysisController.getMACD(req as any, res))
);

// GET /api/analysis/:symbol/:timeframe/bollinger
router.get(
  '/:symbol/:timeframe/bollinger',
  asyncHandler((req, res) => analysisController.getBollingerBands(req as any, res))
);

// GET /api/analysis/:symbol/:timeframe/sma
router.get(
  '/:symbol/:timeframe/sma',
  asyncHandler((req, res) => analysisController.getSMA(req as any, res))
);

// GET /api/analysis/:symbol/:timeframe/ema
router.get(
  '/:symbol/:timeframe/ema',
  asyncHandler((req, res) => analysisController.getEMA(req as any, res))
);

export default router;

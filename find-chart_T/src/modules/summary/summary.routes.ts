import { Router, Request, Response } from 'express';
import { summaryController } from './summary.controller';
import { asyncHandler } from '../../shared';

const router = Router();

// GET /api/summary/status - 데이터 상태 확인 (먼저 정의해야 :symbol 보다 우선)
router.get(
  '/status',
  asyncHandler((req: Request, res: Response) => summaryController.getDataStatus(req, res))
);

// GET /api/summary?symbols=QQQ,SPY - 여러 심볼 일괄 조회
router.get(
  '/',
  asyncHandler((req: Request, res: Response) => summaryController.getMultipleSummaries(req as any, res))
);

// GET /api/summary/:symbol - 단일 심볼 조회
router.get(
  '/:symbol',
  asyncHandler((req: Request, res: Response) => summaryController.getSummary(req as any, res))
);

export default router;

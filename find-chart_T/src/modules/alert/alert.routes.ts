import { Router } from 'express';
import { alertController } from './alert.controller';
import { asyncHandler } from '../../shared';
import { authMiddleware } from '../auth';

const router = Router();

// 모든 알림 라우트는 인증 필요
router.use(authMiddleware);

// GET /api/alerts
router.get(
  '/',
  asyncHandler((req, res) => alertController.getAlerts(req as any, res))
);

// GET /api/alerts/:id
router.get(
  '/:id',
  asyncHandler((req, res) => alertController.getAlert(req as any, res))
);

// POST /api/alerts
router.post(
  '/',
  asyncHandler((req, res) => alertController.createAlert(req as any, res))
);

// PATCH /api/alerts/:id
router.patch(
  '/:id',
  asyncHandler((req, res) => alertController.updateAlert(req as any, res))
);

// DELETE /api/alerts/:id
router.delete(
  '/:id',
  asyncHandler((req, res) => alertController.deleteAlert(req as any, res))
);

export default router;

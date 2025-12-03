import { Router } from 'express';
import { authController } from './auth.controller';
import { asyncHandler } from '../../shared';

const router = Router();

// POST /api/auth/login
router.post(
  '/login',
  asyncHandler((req, res) => authController.login(req as any, res))
);

// POST /api/auth/register
router.post(
  '/register',
  asyncHandler((req, res) => authController.register(req as any, res))
);

// GET /api/auth/me
router.get(
  '/me',
  // TODO: authMiddleware 추가
  asyncHandler((req, res) => authController.me(req as any, res))
);

export default router;

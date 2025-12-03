import { Router } from 'express';
import { userController } from './user.controller';
import { asyncHandler } from '../../shared';

const router = Router();

// GET /api/users/:id
router.get(
  '/:id',
  asyncHandler((req, res) => userController.getUser(req as any, res))
);

// POST /api/users
router.post(
  '/',
  asyncHandler((req, res) => userController.createUser(req as any, res))
);

// PATCH /api/users/:id
router.patch(
  '/:id',
  asyncHandler((req, res) => userController.updateUser(req as any, res))
);

// DELETE /api/users/:id
router.delete(
  '/:id',
  asyncHandler((req, res) => userController.deleteUser(req as any, res))
);

export default router;

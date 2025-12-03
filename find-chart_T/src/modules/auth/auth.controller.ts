import { Request, Response } from 'express';
import { authService } from './auth.service';
import { LoginDto, RegisterDto } from './auth.types';

export class AuthController {
  /**
   * POST /api/auth/login
   */
  async login(
    req: Request<unknown, unknown, LoginDto>,
    res: Response
  ): Promise<void> {
    const result = await authService.login(req.body);
    res.status(200).json({ success: true, data: result });
  }

  /**
   * POST /api/auth/register
   */
  async register(
    req: Request<unknown, unknown, RegisterDto>,
    res: Response
  ): Promise<void> {
    const result = await authService.register(req.body);
    res.status(201).json({ success: true, data: result });
  }

  /**
   * GET /api/auth/me
   * 현재 로그인된 유저 정보 조회
   */
  async me(req: Request, res: Response): Promise<void> {
    // TODO: 미들웨어에서 req.user에 유저 정보 주입
    const user = (req as any).user;
    
    if (!user) {
      res.status(401).json({ success: false, error: '인증이 필요합니다.' });
      return;
    }

    res.status(200).json({ success: true, data: user });
  }
}

export const authController = new AuthController();

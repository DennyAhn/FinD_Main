import { Request, Response, NextFunction } from 'express';
import { authService } from './auth.service';
import { UnauthorizedError } from '../../shared';

/**
 * JWT 인증 미들웨어
 */
export function authMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('인증 토큰이 필요합니다.');
    }

    const token = authHeader.slice(7); // "Bearer " 제거
    const payload = authService.verifyToken(token);

    // req에 유저 정보 추가
    (req as any).user = {
      id: payload.userId,
      email: payload.email,
    };

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * 선택적 인증 미들웨어 (로그인하지 않아도 접근 가능하지만, 로그인 정보가 있으면 사용)
 */
export function optionalAuthMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      const payload = authService.verifyToken(token);
      
      (req as any).user = {
        id: payload.userId,
        email: payload.email,
      };
    }

    next();
  } catch {
    // 토큰이 유효하지 않아도 계속 진행
    next();
  }
}

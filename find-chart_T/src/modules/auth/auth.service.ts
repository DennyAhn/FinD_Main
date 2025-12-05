import crypto from 'crypto';
import { userRepository } from '../user';
import { LoginDto, RegisterDto, AuthResponse, TokenPayload } from './auth.types';
import { BadRequestError, UnauthorizedError } from '../../shared';
import config from '../../config';

// TODO: 실제로는 jsonwebtoken 패키지 사용
// import jwt from 'jsonwebtoken';

export class AuthService {
  private readonly JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
  private readonly JWT_EXPIRES_IN = '24h';

  /**
   * 로그인
   */
  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await userRepository.findByEmail(dto.email);
    
    if (!user) {
      throw new UnauthorizedError('이메일 또는 비밀번호가 올바르지 않습니다.');
    }

    const passwordHash = this.hashPassword(dto.password);
    if (user.passwordHash !== passwordHash) {
      throw new UnauthorizedError('이메일 또는 비밀번호가 올바르지 않습니다.');
    }

    const token = this.generateToken({ userId: user.id, email: user.email });

    return {
      accessToken: token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    };
  }

  /**
   * 회원가입
   */
  async register(dto: RegisterDto): Promise<AuthResponse> {
    const exists = await userRepository.existsByEmail(dto.email);
    if (exists) {
      throw new BadRequestError('이미 사용 중인 이메일입니다.');
    }

    const passwordHash = this.hashPassword(dto.password);
    const user = await userRepository.create({
      email: dto.email,
      passwordHash,
      ...(dto.name && { name: dto.name }),
    });

    const token = this.generateToken({ userId: user.id, email: user.email });

    return {
      accessToken: token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    };
  }

  /**
   * 토큰 검증
   */
  verifyToken(token: string): TokenPayload {
    try {
      // TODO: 실제 JWT 검증 로직
      // return jwt.verify(token, this.JWT_SECRET) as TokenPayload;
      
      // 임시 구현 (Base64 디코딩)
      const parts = token.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid token format');
      }
      const payload = JSON.parse(Buffer.from(parts[1]!, 'base64').toString());
      return payload as TokenPayload;
    } catch {
      throw new UnauthorizedError('유효하지 않은 토큰입니다.');
    }
  }

  /**
   * 비밀번호 해싱
   */
  private hashPassword(password: string): string {
    // TODO: bcrypt로 교체
    return crypto.createHash('sha256').update(password).digest('hex');
  }

  /**
   * JWT 생성
   */
  private generateToken(payload: Omit<TokenPayload, 'iat' | 'exp'>): string {
    // TODO: 실제 JWT 생성 로직
    // return jwt.sign(payload, this.JWT_SECRET, { expiresIn: this.JWT_EXPIRES_IN });
    
    // 임시 구현 (Base64 인코딩)
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64');
    const now = Math.floor(Date.now() / 1000);
    const fullPayload = {
      ...payload,
      iat: now,
      exp: now + 24 * 60 * 60, // 24시간
    };
    const payloadBase64 = Buffer.from(JSON.stringify(fullPayload)).toString('base64');
    const signature = crypto
      .createHmac('sha256', this.JWT_SECRET)
      .update(`${header}.${payloadBase64}`)
      .digest('base64');
    
    return `${header}.${payloadBase64}.${signature}`;
  }
}

export const authService = new AuthService();

import { userRepository } from './user.repository';
import { CreateUserDto, UpdateUserDto, UserResponse } from './user.types';
import { NotFoundError, BadRequestError } from '../../shared';
import crypto from 'crypto';

export class UserService {
  /**
   * 유저 조회
   */
  async getUserById(id: string): Promise<UserResponse> {
    const user = await userRepository.findById(id);
    
    if (!user) {
      throw new NotFoundError('사용자를 찾을 수 없습니다.');
    }

    return this.toResponse(user);
  }

  /**
   * 유저 생성
   */
  async createUser(dto: CreateUserDto): Promise<UserResponse> {
    // 이메일 중복 검사
    const exists = await userRepository.existsByEmail(dto.email);
    if (exists) {
      throw new BadRequestError('이미 사용 중인 이메일입니다.');
    }

    // 비밀번호 해싱 (실제로는 bcrypt 사용 권장)
    const passwordHash = this.hashPassword(dto.password);

    const user = await userRepository.create({
      email: dto.email,
      passwordHash,
      ...(dto.name && { name: dto.name }),
    });

    return this.toResponse(user);
  }

  /**
   * 유저 업데이트
   */
  async updateUser(id: string, dto: UpdateUserDto): Promise<UserResponse> {
    const existing = await userRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('사용자를 찾을 수 없습니다.');
    }

    // 이메일 변경 시 중복 검사
    if (dto.email && dto.email !== existing.email) {
      const exists = await userRepository.existsByEmail(dto.email);
      if (exists) {
        throw new BadRequestError('이미 사용 중인 이메일입니다.');
      }
    }

    const user = await userRepository.update(id, dto);
    return this.toResponse(user);
  }

  /**
   * 유저 삭제
   */
  async deleteUser(id: string): Promise<void> {
    const existing = await userRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('사용자를 찾을 수 없습니다.');
    }

    await userRepository.delete(id);
  }

  /**
   * 비밀번호 해싱 (간단한 구현, 실제로는 bcrypt 사용)
   */
  private hashPassword(password: string): string {
    // TODO: bcrypt로 교체
    return crypto.createHash('sha256').update(password).digest('hex');
  }

  /**
   * User -> UserResponse 변환
   */
  private toResponse(user: any): UserResponse {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
    };
  }
}

export const userService = new UserService();

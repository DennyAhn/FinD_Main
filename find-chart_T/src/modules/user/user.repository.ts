import { prisma } from '../../shared';
import { User, CreateUserDto, UpdateUserDto } from './user.types';

export class UserRepository {
  /**
   * ID로 유저 조회
   */
  async findById(id: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { id },
    });
  }

  /**
   * 이메일로 유저 조회
   */
  async findByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { email },
    });
  }

  /**
   * 유저 생성
   */
  async create(data: {
    email: string;
    passwordHash: string;
    name?: string;
  }): Promise<User> {
    return prisma.user.create({
      data: {
        email: data.email,
        passwordHash: data.passwordHash,
        name: data.name ?? null,
      },
    });
  }

  /**
   * 유저 업데이트
   */
  async update(id: string, data: UpdateUserDto): Promise<User> {
    return prisma.user.update({
      where: { id },
      data,
    });
  }

  /**
   * 유저 삭제
   */
  async delete(id: string): Promise<void> {
    await prisma.user.delete({
      where: { id },
    });
  }

  /**
   * 이메일 존재 여부 확인
   */
  async existsByEmail(email: string): Promise<boolean> {
    const count = await prisma.user.count({
      where: { email },
    });
    return count > 0;
  }
}

export const userRepository = new UserRepository();

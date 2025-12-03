import { prisma } from '../../shared';
import { Alert, CreateAlertDto, UpdateAlertDto, AlertStatus } from './alert.types';

export class AlertRepository {
  /**
   * ID로 알림 조회
   */
  async findById(id: string): Promise<Alert | null> {
    return prisma.alert.findUnique({
      where: { id },
    }) as any;
  }

  /**
   * 유저의 알림 목록 조회
   */
  async findByUserId(
    userId: string,
    options?: { symbol?: string; status?: AlertStatus }
  ): Promise<Alert[]> {
    const where: any = { userId };
    
    if (options?.symbol) {
      where.symbol = options.symbol;
    }
    if (options?.status) {
      where.status = options.status;
    }

    return prisma.alert.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    }) as any;
  }

  /**
   * 활성화된 가격 알림 조회 (특정 심볼)
   */
  async findActivePriceAlerts(symbol: string): Promise<Alert[]> {
    return prisma.alert.findMany({
      where: {
        symbol,
        type: 'price',
        status: 'active',
      },
    }) as any;
  }

  /**
   * 알림 생성
   */
  async create(userId: string, data: CreateAlertDto): Promise<Alert> {
    return prisma.alert.create({
      data: {
        userId,
        symbol: data.symbol,
        type: data.type,
        condition: data.condition,
        value: data.value,
        indicator: data.indicator ?? null,
        indicatorParams: data.indicatorParams as any ?? null,
        timeframe: data.timeframe ?? null,
        status: 'active',
      },
    }) as any;
  }

  /**
   * 알림 업데이트
   */
  async update(id: string, data: UpdateAlertDto): Promise<Alert> {
    return prisma.alert.update({
      where: { id },
      data,
    }) as any;
  }

  /**
   * 알림 트리거 처리
   */
  async markAsTriggered(id: string): Promise<Alert> {
    return prisma.alert.update({
      where: { id },
      data: {
        status: 'triggered',
        triggeredAt: new Date(),
      },
    }) as any;
  }

  /**
   * 알림 삭제
   */
  async delete(id: string): Promise<void> {
    await prisma.alert.delete({
      where: { id },
    });
  }
}

export const alertRepository = new AlertRepository();

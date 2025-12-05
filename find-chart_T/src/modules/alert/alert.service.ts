import { alertRepository } from './alert.repository';
import { 
  CreateAlertDto, 
  UpdateAlertDto, 
  AlertResponse, 
  AlertStatus,
  Alert 
} from './alert.types';
import { NotFoundError, ForbiddenError } from '../../shared';

export class AlertService {
  /**
   * 유저의 알림 목록 조회
   */
  async getAlerts(
    userId: string,
    options?: { symbol?: string; status?: AlertStatus }
  ): Promise<AlertResponse[]> {
    const alerts = await alertRepository.findByUserId(userId, options);
    return alerts.map(this.toResponse);
  }

  /**
   * 단일 알림 조회
   */
  async getAlertById(userId: string, alertId: string): Promise<AlertResponse> {
    const alert = await alertRepository.findById(alertId);
    
    if (!alert) {
      throw new NotFoundError('알림을 찾을 수 없습니다.');
    }

    if (alert.userId !== userId) {
      throw new ForbiddenError('접근 권한이 없습니다.');
    }

    return this.toResponse(alert);
  }

  /**
   * 알림 생성
   */
  async createAlert(userId: string, dto: CreateAlertDto): Promise<AlertResponse> {
    // 지표 알림인 경우 필수 필드 검증
    if (dto.type === 'indicator') {
      if (!dto.indicator || !dto.timeframe) {
        throw new Error('지표 알림은 indicator와 timeframe이 필요합니다.');
      }
    }

    const alert = await alertRepository.create(userId, dto);
    return this.toResponse(alert);
  }

  /**
   * 알림 수정
   */
  async updateAlert(
    userId: string,
    alertId: string,
    dto: UpdateAlertDto
  ): Promise<AlertResponse> {
    const existing = await alertRepository.findById(alertId);
    
    if (!existing) {
      throw new NotFoundError('알림을 찾을 수 없습니다.');
    }

    if (existing.userId !== userId) {
      throw new ForbiddenError('접근 권한이 없습니다.');
    }

    const alert = await alertRepository.update(alertId, dto);
    return this.toResponse(alert);
  }

  /**
   * 알림 삭제
   */
  async deleteAlert(userId: string, alertId: string): Promise<void> {
    const existing = await alertRepository.findById(alertId);
    
    if (!existing) {
      throw new NotFoundError('알림을 찾을 수 없습니다.');
    }

    if (existing.userId !== userId) {
      throw new ForbiddenError('접근 권한이 없습니다.');
    }

    await alertRepository.delete(alertId);
  }

  /**
   * 가격 알림 체크 (실시간 틱 수신 시 호출)
   */
  async checkPriceAlerts(symbol: string, currentPrice: number): Promise<Alert[]> {
    const alerts = await alertRepository.findActivePriceAlerts(symbol);
    const triggeredAlerts: Alert[] = [];

    for (const alert of alerts) {
      let shouldTrigger = false;

      switch (alert.condition) {
        case 'above':
          shouldTrigger = currentPrice >= alert.value;
          break;
        case 'below':
          shouldTrigger = currentPrice <= alert.value;
          break;
        // cross_above, cross_below는 이전 가격 데이터 필요
        default:
          break;
      }

      if (shouldTrigger) {
        const triggered = await alertRepository.markAsTriggered(alert.id);
        triggeredAlerts.push(triggered);
        
        // TODO: 알림 전송 (Push, Email, WebSocket 등)
        console.log(`[Alert Triggered] ${symbol} ${alert.condition} ${alert.value}`);
      }
    }

    return triggeredAlerts;
  }

  /**
   * Alert -> AlertResponse 변환
   */
  private toResponse(alert: Alert): AlertResponse {
    return {
      id: alert.id,
      symbol: alert.symbol,
      type: alert.type,
      condition: alert.condition,
      value: alert.value,
      indicator: alert.indicator,
      indicatorParams: alert.indicatorParams,
      timeframe: alert.timeframe,
      status: alert.status,
      triggeredAt: alert.triggeredAt,
      createdAt: alert.createdAt,
    };
  }
}

export const alertService = new AlertService();

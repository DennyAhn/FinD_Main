// Alert 관련 타입 정의

export type AlertType = 'price' | 'indicator';
export type AlertCondition = 'above' | 'below' | 'cross_above' | 'cross_below';
export type AlertStatus = 'active' | 'triggered' | 'disabled';

export interface Alert {
  id: string;
  userId: string;
  symbol: string;
  type: AlertType;
  condition: AlertCondition;
  value: number;
  
  // indicator 타입일 때만 사용
  indicator?: string; // 'rsi', 'macd', etc.
  indicatorParams?: Record<string, number>;
  timeframe?: string;
  
  status: AlertStatus;
  triggeredAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAlertDto {
  symbol: string;
  type: AlertType;
  condition: AlertCondition;
  value: number;
  indicator?: string;
  indicatorParams?: Record<string, number>;
  timeframe?: string;
}

export interface UpdateAlertDto {
  condition?: AlertCondition;
  value?: number;
  status?: AlertStatus;
}

export interface AlertResponse {
  id: string;
  symbol: string;
  type: AlertType;
  condition: AlertCondition;
  value: number;
  indicator?: string | undefined;
  indicatorParams?: Record<string, number> | undefined;
  timeframe?: string | undefined;
  status: AlertStatus;
  triggeredAt?: Date | undefined;
  createdAt: Date;
}

// Request 파라미터
export interface AlertParams {
  id: string;
}

export interface AlertQuery {
  symbol?: string;
  status?: AlertStatus;
}

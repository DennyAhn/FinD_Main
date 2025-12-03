/**
 * Moving Averages (SMA, EMA)
 * 라이브러리: technicalindicators
 * 
 * 최적화된 Sliding Window 알고리즘 사용 (O(N))
 */

import { SMA, EMA } from 'technicalindicators';
import { IndicatorResult, SMAOptions, EMAOptions } from '../analysis.types';

/**
 * SMA (Simple Moving Average)
 */
export function calculateSMA(
  closes: number[],
  options: SMAOptions
): IndicatorResult[] {
  const { period } = options;

  if (closes.length < period) {
    return [];
  }

  const smaValues = SMA.calculate({
    period,
    values: closes,
  });

  return smaValues.map(value => ({
    time: 0, // Service 레벨에서 매핑
    value,
  }));
}

/**
 * EMA (Exponential Moving Average)
 */
export function calculateEMA(
  closes: number[],
  options: EMAOptions
): IndicatorResult[] {
  const { period } = options;

  if (closes.length < period) {
    return [];
  }

  const emaValues = EMA.calculate({
    period,
    values: closes,
  });

  return emaValues.map(value => ({
    time: 0,
    value,
  }));
}

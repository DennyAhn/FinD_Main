/**
 * RSI (Relative Strength Index)
 * 라이브러리: technicalindicators
 * 
 * Wilder's Smoothing Method 사용 (표준 RSI 계산)
 */

import { RSI } from 'technicalindicators';
import { IndicatorResult, RSIOptions } from '../analysis.types';

/**
 * RSI (Relative Strength Index)
 * 
 * RSI = 100 - (100 / (1 + RS))
 * RS = Average Gain / Average Loss
 */
export function calculateRSI(
  closes: number[],
  options: RSIOptions = {}
): IndicatorResult[] {
  const { period = 14 } = options;

  if (closes.length < period + 1) {
    return [];
  }

  const rsiValues = RSI.calculate({
    period,
    values: closes,
  });

  return rsiValues.map(value => ({
    time: 0, // Service 레벨에서 매핑
    value,
  }));
}

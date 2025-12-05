/**
 * Bollinger Bands
 * 라이브러리: technicalindicators
 * 
 * 표준 볼린저 밴드 계산 (SMA + 표준편차)
 */

import { BollingerBands } from 'technicalindicators';
import { BollingerBandsResult, BollingerOptions } from '../analysis.types';

/**
 * Bollinger Bands
 * 
 * Middle Band = SMA(period)
 * Upper Band = SMA + (stdDev * multiplier)
 * Lower Band = SMA - (stdDev * multiplier)
 */
export function calculateBollingerBands(
  closes: number[],
  options: BollingerOptions = {}
): BollingerBandsResult[] {
  const { period = 20, stdDev = 2 } = options;

  if (closes.length < period) {
    return [];
  }

  const bbOutput = BollingerBands.calculate({
    period,
    stdDev,
    values: closes,
  });

  return bbOutput.map(item => ({
    time: 0, // Service 레벨에서 매핑
    upper: item.upper,
    middle: item.middle,
    lower: item.lower,
  }));
}

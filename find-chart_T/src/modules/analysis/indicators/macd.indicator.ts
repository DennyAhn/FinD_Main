/**
 * MACD (Moving Average Convergence Divergence)
 * 라이브러리: technicalindicators
 * 
 * EMA 기반 표준 MACD 계산
 */

import { MACD } from 'technicalindicators';
import { MACDResult, MACDOptions } from '../analysis.types';

/**
 * MACD (Moving Average Convergence Divergence)
 * 
 * MACD Line = 12 EMA - 26 EMA
 * Signal Line = 9 EMA of MACD Line
 * Histogram = MACD Line - Signal Line
 */
export function calculateMACD(
  closes: number[],
  options: MACDOptions = {}
): MACDResult[] {
  const { 
    fastPeriod = 12, 
    slowPeriod = 26, 
    signalPeriod = 9 
  } = options;

  const minRequired = Math.max(fastPeriod, slowPeriod) + signalPeriod;
  if (closes.length < minRequired) {
    return [];
  }

  const macdOutput = MACD.calculate({
    values: closes,
    fastPeriod,
    slowPeriod,
    signalPeriod,
    SimpleMAOscillator: false, // EMA 사용 (표준)
    SimpleMASignal: false,
  });

  return macdOutput.map(item => ({
    time: 0, // Service 레벨에서 매핑
    macd: item.MACD ?? 0,
    signal: item.signal ?? 0,
    histogram: item.histogram ?? 0,
  }));
}

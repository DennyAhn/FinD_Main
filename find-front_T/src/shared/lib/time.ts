import { TIMEFRAME_MINUTES } from '@/shared/config/chart';

export function getStartOfCandle(timestamp: number, timeframe: string): number {
  const minutes = TIMEFRAME_MINUTES[timeframe] || 1;
  const seconds = minutes * 60;
  return Math.floor(timestamp / seconds) * seconds;
}

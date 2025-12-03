import Bottleneck from 'bottleneck';

/**
 * TwelveData API Rate Limiter (Pro Plan Optimized)
 * Limit: 610 requests / minute
 * * Target: ~10 requests / second (Safe margin)
 * minTime: 100ms
 */
export const twelveDataLimiter = new Bottleneck({
  // 동시에 날릴 요청 수
  maxConcurrent: 10,
  
  // 요청 간 최소 간격 (ms)
  // 60000 / 600 = 100ms
  minTime: 100, 

  // 대기열 관리
  highWater: 5000, 
  strategy: Bottleneck.strategy.LEAK,
});

twelveDataLimiter.on('failed', async (error, jobInfo) => {
  console.warn(`⚠️ API 요청 실패 (Retry: ${jobInfo.retryCount}): ${error}`);
  if (jobInfo.retryCount < 3) {
    return 1000 * (2 ** jobInfo.retryCount);
  }
});
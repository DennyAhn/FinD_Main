import { useEffect, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchHistoricalCandles } from '@/services/api/chartApi';
import { chartWebSocket } from '@/services/api/chartWebSocket';
import type { ChartData, WSMessage } from '@/types/candle';
import { getStartOfCandle } from '@/shared/lib/time';
import { UP_COLOR, DOWN_COLOR } from '@/shared/config/chart';
import type { UTCTimestamp } from 'lightweight-charts';

export const useChartData = (symbol: string, timeframe: string) => {
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => ['candles', symbol, timeframe], [symbol, timeframe]);

  // 1. 초기 데이터 로드
  const { data, isLoading } = useQuery({
    queryKey: queryKey,
    queryFn: ({ signal }) => fetchHistoricalCandles(symbol, timeframe, undefined, undefined, undefined, signal as AbortSignal),
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  // 2. 웹소켓 구독 및 실시간 데이터 병합
  useEffect(() => {
    const unsubscribe = chartWebSocket.subscribe((msg: WSMessage) => {
      if (msg.type === 'reconnected') return;
      if (msg.symbol !== symbol) return;

      queryClient.setQueryData<ChartData[]>(queryKey, (oldData) => {
        if (!oldData) return oldData;

        // A. 완성봉 처리
        if (msg.type === 'candle' && msg.timeframe === timeframe) {
          const c = msg.candle;
          if (!c) return oldData; 

          const newCandle: ChartData = {
            candle: { time: c.startTime as UTCTimestamp, open: c.open, high: c.high, low: c.low, close: c.close },
            volume: { time: c.startTime as UTCTimestamp, value: c.volume, color: c.close >= c.open ? UP_COLOR : DOWN_COLOR },
          };
          
          const lastIdx = oldData.length - 1;
          if (oldData[lastIdx].candle.time === newCandle.candle.time) {
            const newData = [...oldData];
            newData[lastIdx] = newCandle;
            return newData;
          } else {
            return [...oldData, newCandle];
          }
        }
        
        // B. 실시간 틱 처리
        else if (msg.type === 'tick') {
          if (!msg.timestamp || !msg.price) return oldData;

          const price = Number(msg.price);
          const volume = Number(msg.volume || 0);
          const candleStartTime = getStartOfCandle(msg.timestamp, timeframe) as UTCTimestamp;

          const newData = [...oldData];
          const lastIndex = newData.length - 1;
          const lastBar = newData[lastIndex];

          if ((lastBar.candle.time as number) === (candleStartTime as number)) {
            const updatedCandle = {
              ...lastBar.candle,
              close: price,
              high: Math.max(lastBar.candle.high, price),
              low: Math.min(lastBar.candle.low, price),
            };
            const updatedVolume = {
              ...lastBar.volume,
              value: lastBar.volume.value + volume,
              color: updatedCandle.close >= updatedCandle.open ? UP_COLOR : DOWN_COLOR
            };
            newData[lastIndex] = { candle: updatedCandle, volume: updatedVolume };
            return newData;
          } 
          else if ((lastBar.candle.time as number) < (candleStartTime as number)) {
            const newCandle: ChartData = {
              candle: { time: candleStartTime, open: price, high: price, low: price, close: price },
              volume: { time: candleStartTime, value: volume, color: UP_COLOR }
            };
            return [...newData, newCandle];
          }
        }
        return oldData;
      });
    });

    return () => { unsubscribe(); }; 
  }, [symbol, timeframe, queryClient, queryKey]);

  // 3. 과거 데이터 더 불러오기
  const loadMoreHistory = useCallback(async () => {
    const currentData = queryClient.getQueryData<ChartData[]>(queryKey);
    if (!currentData || currentData.length === 0) return;

    const firstCandleTime = currentData[0].candle.time as number;
    
    try {
      const olderData = await fetchHistoricalCandles(symbol, timeframe, firstCandleTime);
      
      if (olderData.length > 0) {
        queryClient.setQueryData<ChartData[]>(queryKey, (old) => {
          if (!old) return olderData;
          // Merge and de-duplicate by time (ascending arrays, possible boundary overlap)
          const merged = [...olderData, ...old];
          const dedup: ChartData[] = [];
          let lastTime: number | undefined;
          for (const item of merged) {
            const t = item.candle.time as number;
            if (t !== lastTime) {
              dedup.push(item);
              lastTime = t;
            }
          }
          return dedup;
        });
      }
    } catch (e) {
      console.error("Failed to load history", e);
    }
  }, [symbol, timeframe, queryClient, queryKey]);

  return { 
    data: data || [], 
    isLoading,
    loadMoreHistory 
  };
};

import { useEffect, useRef } from 'react';
import { createChart, IChartApi, ISeriesApi, CandlestickSeries, HistogramSeries, ColorType, Time, LogicalRange } from 'lightweight-charts';
import type { ChartData } from '@/types/candle';
import { CHART_HEIGHT, VOLUME_CHART_HEIGHT } from '@/shared/config/chart';

const isIntraday = (tf: string) => ['1m', '5m', '15m', '30m', '1h', '4h'].includes(tf);

export const useChart = (
  chartContainerRef: React.RefObject<HTMLDivElement>,
  volumeContainerRef: React.RefObject<HTMLDivElement>,
  data: ChartData[],
  timeframe: string,
  onLoadMore?: () => void
) => {
  const chartApiRef = useRef<IChartApi | null>(null);
  const volumeApiRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);

  const isChartReadyRef = useRef<boolean>(false);
  const renderedDataLengthRef = useRef<number>(0);
  const isLoadingMoreRef = useRef<boolean>(false);

  // 1. 차트 생성 및 옵션 설정
  useEffect(() => {
    if (!chartContainerRef.current || !volumeContainerRef.current) return;

    const timeScaleOptions = {
      timeVisible: isIntraday(timeframe), 
      secondsVisible: false,
      borderColor: '#2a2a2a',
    };

    const commonPriceScaleOption = {
      visible: true,
      minimumWidth: 75,
      borderColor: '#2a2a2a',
    };

    // 한국 시간(KST, UTC+9) 포맷터
    const localizationOptions = {
      locale: 'ko-KR',
      timeFormatter: (time: number) => {
        const date = new Date(time * 1000 + 9 * 60 * 60 * 1000); // UTC+9
        const hours = date.getUTCHours().toString().padStart(2, '0');
        const minutes = date.getUTCMinutes().toString().padStart(2, '0');
        return `${hours}:${minutes}`;
      },
    };

    // --- 메인 차트 ---
    const chartApi = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: CHART_HEIGHT,
      layout: { background: { type: ColorType.Solid, color: '#1a1a1a' }, textColor: '#e5e7eb' },
      grid: { vertLines: { color: 'rgba(42, 42, 42, 0.35)' }, horzLines: { color: 'rgba(42, 42, 42, 0.35)' } },
      timeScale: { visible: false, ...timeScaleOptions },
      rightPriceScale: {
        ...commonPriceScaleOption,
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      localization: localizationOptions,
    });

    candlestickSeriesRef.current = chartApi.addSeries(CandlestickSeries, { 
      upColor: '#26a69a', downColor: '#ef5350', borderVisible: false, wickUpColor: '#26a69a', wickDownColor: '#ef5350' 
    });
    
    // --- 거래량 차트 ---
    const volumeApi = createChart(volumeContainerRef.current, {
      width: volumeContainerRef.current.clientWidth,
      height: VOLUME_CHART_HEIGHT,
      layout: { background: { type: ColorType.Solid, color: '#1a1a1a' }, textColor: '#e5e7eb' },
      grid: { vertLines: { color: 'rgba(42, 42, 42, 0.35)' }, horzLines: { color: 'rgba(42, 42, 42, 0.35)' } },
      timeScale: { visible: true, ...timeScaleOptions },
      rightPriceScale: {
        ...commonPriceScaleOption,
        scaleMargins: { top: 0.3, bottom: 0 },
      },
      localization: localizationOptions,
    });

    volumeSeriesRef.current = volumeApi.addSeries(HistogramSeries, { 
      color: '#26a69a', priceFormat: { type: 'volume' },
    });

    const handleVisibleLogicalRangeChange = (newVisibleLogicalRange: LogicalRange | null) => {
      if (newVisibleLogicalRange && newVisibleLogicalRange.from < 10) {
        if (onLoadMore && !isLoadingMoreRef.current) {
          isLoadingMoreRef.current = true;
          onLoadMore();
        }
      }
    };
    chartApi.timeScale().subscribeVisibleLogicalRangeChange(handleVisibleLogicalRangeChange);

    // 동기화 로직
    chartApi.timeScale().subscribeVisibleLogicalRangeChange(range => {
      if (range) volumeApi.timeScale().setVisibleLogicalRange(range);
    });
    volumeApi.timeScale().subscribeVisibleLogicalRangeChange(range => {
      if (range) chartApi.timeScale().setVisibleLogicalRange(range);
    });

    const handleResize = () => {
      if (chartContainerRef.current) chartApi.resize(chartContainerRef.current.clientWidth, CHART_HEIGHT);
      if (volumeContainerRef.current) volumeApi.resize(volumeContainerRef.current.clientWidth, VOLUME_CHART_HEIGHT);
    };
    window.addEventListener('resize', handleResize);

    chartApiRef.current = chartApi;
    volumeApiRef.current = volumeApi;

    return () => {
      window.removeEventListener('resize', handleResize);
      chartApi.remove();
      volumeApi.remove();
      isChartReadyRef.current = false;
      renderedDataLengthRef.current = 0;
      isLoadingMoreRef.current = false;
    };
  }, [timeframe, chartContainerRef, volumeContainerRef, onLoadMore]); 

  // 2. 데이터 업데이트 로직
  useEffect(() => {
    if (!data || data.length === 0) return;
    if (!candlestickSeriesRef.current || !volumeSeriesRef.current) return;

    const currentLength = renderedDataLengthRef.current;
    const newLength = data.length;

    if (newLength > currentLength) {
        isLoadingMoreRef.current = false;
    }

    if (!isChartReadyRef.current) {
      candlestickSeriesRef.current.setData(data.map(d => ({ ...d.candle, time: d.candle.time as Time })));
      volumeSeriesRef.current.setData(data.map(d => ({ ...d.volume, time: d.volume.time as Time })));
      
      isChartReadyRef.current = true;
      renderedDataLengthRef.current = newLength;
    } 
    else {
      const firstCandleTime = candlestickSeriesRef.current.data()[0]?.time;
      const newFirstTime = data[0].candle.time;
      
      const isHistoryPrepend = firstCandleTime !== undefined && (newFirstTime as number) < (firstCandleTime as number);

      if (isHistoryPrepend) {
        candlestickSeriesRef.current.setData(data.map(d => ({ ...d.candle, time: d.candle.time as Time })));
        volumeSeriesRef.current.setData(data.map(d => ({ ...d.volume, time: d.volume.time as Time })));
      } else {
        for (let i = Math.max(0, currentLength - 1); i < newLength; i++) {
          const item = data[i];
          candlestickSeriesRef.current.update({ ...item.candle, time: item.candle.time as Time });
          volumeSeriesRef.current.update({ ...item.volume, time: item.volume.time as Time });
        }
      }
      renderedDataLengthRef.current = newLength;
    }
  }, [data]);
};

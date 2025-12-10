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

  // ✅ [추가] 현재 차트에 적용된 타임프레임을 추적하기 위한 Ref
  const currentPropsTimeframeRef = useRef<string>(timeframe);

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
      // cleanup 시에는 ref를 초기화하지 않음 (다음 렌더링 시 비교를 위해)
    };
  }, [timeframe, chartContainerRef, volumeContainerRef, onLoadMore]); 

  // 2. 데이터 업데이트 로직 (수정됨)
  useEffect(() => {
    if (!data || data.length === 0) return;
    if (!candlestickSeriesRef.current || !volumeSeriesRef.current) return;

    // ✅ 타임프레임이 변경되었는지 확인
    const isTimeframeChanged = currentPropsTimeframeRef.current !== timeframe;

    // ✅ 타임프레임 변경 시 or 차트 초기화 시 -> 전체 데이터 새로 세팅 (setData)
    if (isTimeframeChanged || !isChartReadyRef.current) {
      candlestickSeriesRef.current.setData(data.map(d => ({ ...d.candle, time: d.candle.time as Time })));
      volumeSeriesRef.current.setData(data.map(d => ({ ...d.volume, time: d.volume.time as Time })));
      
      isChartReadyRef.current = true;
      renderedDataLengthRef.current = data.length;
      currentPropsTimeframeRef.current = timeframe; // 변경된 타임프레임 반영
      isLoadingMoreRef.current = false;
      return;
    }

    // --- 여기서부터는 실시간 업데이트 로직 ---
    const currentLength = renderedDataLengthRef.current;
    const newLength = data.length;

    if (newLength > currentLength) {
        isLoadingMoreRef.current = false;
    }

    const firstCandleTime = candlestickSeriesRef.current.data()[0]?.time;
    const newFirstTime = data[0].candle.time;
    
    // 과거 데이터 로딩 (Prepend)
    const isHistoryPrepend = firstCandleTime !== undefined && 
       ((newFirstTime as number) < (firstCandleTime as number));

    if (isHistoryPrepend) {
      candlestickSeriesRef.current.setData(data.map(d => ({ ...d.candle, time: d.candle.time as Time })));
      volumeSeriesRef.current.setData(data.map(d => ({ ...d.volume, time: d.volume.time as Time })));
    } else {
      // 실시간 데이터 추가 (Update)
      for (let i = Math.max(0, currentLength - 1); i < newLength; i++) {
        const item = data[i];
        try {
          candlestickSeriesRef.current.update({ ...item.candle, time: item.candle.time as Time });
          volumeSeriesRef.current.update({ ...item.volume, time: item.volume.time as Time });
        } catch (error) {
          // 🛡️ 안전장치: update 실패 시 (타임스탬프 꼬임 등) setData로 강제 동기화
          console.warn('Chart update failed, forcing refresh:', error);
          candlestickSeriesRef.current.setData(data.map(d => ({ ...d.candle, time: d.candle.time as Time })));
          volumeSeriesRef.current.setData(data.map(d => ({ ...d.volume, time: d.volume.time as Time })));
          break;
        }
      }
    }
    renderedDataLengthRef.current = newLength;

  }, [data, timeframe]); // ✅ timeframe 의존성 필수
};
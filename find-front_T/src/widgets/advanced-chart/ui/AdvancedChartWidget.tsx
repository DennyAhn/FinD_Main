import { useRef } from 'react';
import { useChartStore } from '@/store/useChartSettingsStore';
import { useChartData } from '../lib/useChartData';
import { useChart } from '../lib/useChart';
import { CHART_HEIGHT, VOLUME_CHART_HEIGHT } from '@/shared/config/chart';
import { TimeframeSelector } from '@/components/chart-settings/TimeframeSelector';
import './AdvancedChartWidget.css';

interface AdvancedChartWidgetProps {
  symbol: string;
}

export const AdvancedChartWidget = ({ symbol }: AdvancedChartWidgetProps) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const volumeContainerRef = useRef<HTMLDivElement>(null);

  const timeframe = useChartStore((state) => state.timeframe);
  const { data, loadMoreHistory, isLoading } = useChartData(symbol, timeframe);

  useChart(
    chartContainerRef,
    volumeContainerRef,
    data,
    timeframe,
    loadMoreHistory
  );

  return (
    <div className="advanced-chart-container">
      {/* 타임프레임 선택기 */}
      <div className="chart-controls">
        <TimeframeSelector />
      </div>

      {/* 로딩 상태 */}
      {isLoading && data.length === 0 && (
        <div className="chart-loading">
          차트 로딩 중...
        </div>
      )}

      {/* 메인 차트 */}
      <div 
        ref={chartContainerRef} 
        className="chart-main"
        style={{ height: `${CHART_HEIGHT}px` }}
      />
      
      {/* 거래량 차트 */}
      <div 
        ref={volumeContainerRef} 
        className="chart-volume"
        style={{ height: `${VOLUME_CHART_HEIGHT}px` }}
      />
    </div>
  );
};

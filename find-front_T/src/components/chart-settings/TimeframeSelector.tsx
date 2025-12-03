import { useChartStore } from '@/store/useChartSettingsStore';
import { MINUTE_TIMEFRAMES, PERIOD_TIMEFRAMES } from '@/shared/config/chart';
import './TimeframeSelector.css';

export const TimeframeSelector = () => {
  const timeframe = useChartStore((state) => state.timeframe);
  const { setTimeframe } = useChartStore((state) => state.actions);

  const renderButton = (tf: string) => {
    const isActive = timeframe === tf;
    return (
      <button
        key={tf}
        onClick={() => setTimeframe(tf)}
        className={`tf-button ${isActive ? 'active' : ''}`}
      >
        {tf}
      </button>
    );
  };

  return (
    <div className="tf-selector">
      {/* 분봉 그룹 */}
      <div className="tf-group">
        {MINUTE_TIMEFRAMES.map(renderButton)}
      </div>
      
      {/* 구분선 */}
      <div className="tf-divider" />
      
      {/* 일봉/주봉/월봉 그룹 */}
      <div className="tf-group">
        {PERIOD_TIMEFRAMES.map(renderButton)}
      </div>
    </div>
  );
};

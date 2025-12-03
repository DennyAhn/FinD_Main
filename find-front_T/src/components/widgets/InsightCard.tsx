import type { InsightCardWidget } from '@/types'
import './Widgets.css'

interface Props {
  widget: InsightCardWidget
}

export default function InsightCard({ widget }: Props) {
  return (
    <div className="insight-card">
      {widget.title && <h3 className="insight-card-title">{widget.title}</h3>}
      <div className="insight-card-content">
        <div className="insight-metrics">
          {widget.metrics.map((metric, idx) => {
            const tooltipText = widget.highlights[idx] // 같은 순서로 매핑
            return (
              <div key={idx} className="insight-metric-badge">
                <span className="insight-metric-label">{metric.label}</span>
                <strong className={`insight-metric-value ${metric.status}`}>
                  {metric.value}
                </strong>
                {tooltipText && (
                  <div className="insight-metric-tooltip">
                    {tooltipText}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}


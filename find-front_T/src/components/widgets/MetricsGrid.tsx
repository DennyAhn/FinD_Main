import { MetricsGridWidget } from '@/types'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import './Widgets.css'

interface Props {
  widget: MetricsGridWidget
}

export default function MetricsGrid({ widget }: Props) {
  return (
    <div className="metrics-grid-layout">
      {widget.items.map((item, index) => {
        let StatusIcon = Minus
        let iconColor = '#94a3b8'

        if (item.trend === 'up') {
          StatusIcon = TrendingUp
          iconColor = '#4ade80'
        } else if (item.trend === 'down') {
          StatusIcon = TrendingDown
          iconColor = '#f87171'
        }

        let statusColor = '#e2e8f0'
        if (item.status === 'good') statusColor = '#4ade80'
        if (item.status === 'bad') statusColor = '#f87171'
        if (item.status === 'warning') statusColor = '#facc15'

        return (
          <div key={index} className="metric-item-card">
            <div className="metric-item-header">
              <span className="metric-label-text">{item.label}</span>
              <StatusIcon size={16} color={iconColor} />
            </div>
            <div className="metric-value-text" style={{ color: statusColor }}>
              {item.formatted}
            </div>
            {item.sub_text && (
              <div className="metric-subtext">{item.sub_text}</div>
            )}
          </div>
        )
      })}
    </div>
  )
}

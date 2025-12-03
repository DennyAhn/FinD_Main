import { AnalystCardWidget } from '@/types'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import './Widgets.css'

interface Props {
  widget: AnalystCardWidget
}

export default function AnalystCard({ widget }: Props) {
  const percentage = Math.max(0, Math.min(100, ((widget.consensus_score - 1) / 4) * 100))

  const gaugeData = [
    { name: 'score', value: percentage },
    { name: 'remainder', value: 100 - percentage },
  ]

  const getGaugeColor = (score: number) => {
    if (score >= 4.5) return '#4ade80'
    if (score >= 3.5) return '#a3e635'
    if (score >= 2.5) return '#facc15'
    if (score >= 1.5) return '#f87171'
    return '#ef4444'
  }

  const gaugeColor = getGaugeColor(widget.consensus_score)

  const bands: Array<keyof AnalystCardWidget['distribution']> = ['strong_buy', 'buy', 'hold', 'sell', 'strong_sell']
  const labelMap: Record<typeof bands[number], string> = {
    strong_buy: 'Strong Buy',
    buy: 'Buy',
    hold: 'Hold',
    sell: 'Sell',
    strong_sell: 'Strong Sell',
  }
  const colorMap: Record<typeof bands[number], string> = {
    strong_buy: '#4ade80',
    buy: '#a3e635',
    hold: '#facc15',
    sell: '#f87171',
    strong_sell: '#ef4444',
  }

  return (
    <div className="widget-card analyst-card-container">
      <div className="analyst-gauge-block">
        <div className="analyst-gauge-chart">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={gaugeData}
                cx="50%"
                cy="100%"
                startAngle={180}
                endAngle={0}
                innerRadius={45}
                outerRadius={70}
                paddingAngle={0}
                dataKey="value"
                stroke="none"
              >
                <Cell key="value" fill={gaugeColor} />
                <Cell key="remainder" fill="#334155" />
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="analyst-gauge-value" style={{ color: gaugeColor }}>
            {widget.consensus_score.toFixed(2)}
          </div>
        </div>
        <div className="analyst-gauge-label" style={{ color: gaugeColor }}>{widget.consensus_rating}</div>
        <div className="analyst-gauge-subtext">{widget.analyst_count} Analysts</div>
      </div>

      <div className="analyst-detail-grid">
        <div className="analyst-upside">
          <p className="analyst-label">Upside Potential</p>
          <div className="analyst-upside-value">
            <span className={widget.upside_percent >= 0 ? 'positive' : 'negative'}>
              {widget.upside_percent > 0 ? '+' : ''}{widget.upside_percent}%
            </span>
            <span className="analyst-upside-target">to Target ${widget.target_price}</span>
          </div>
          <div className="analyst-progress-track">
            <div
              className="analyst-progress-fill"
              style={{ width: `${Math.min(100, (widget.current_price / widget.target_price) * 100)}%` }}
            />
          </div>
          <div className="analyst-progress-labels">
            <span>Current ${widget.current_price}</span>
            <span>Target ${widget.target_price}</span>
          </div>
        </div>

        <div className="analyst-distribution">
          <p className="analyst-label">Analyst Distribution</p>
          <div className="analyst-distribution-list">
            {bands.map((key) => {
              const count = widget.distribution[key]
              if (!count) return null

              return (
                <div key={key} className="analyst-distribution-row">
                  <span>{labelMap[key]}</span>
                  <div className="analyst-distribution-track" title={`${labelMap[key]}: ${count} analysts`}>
                    <div
                      className="analyst-distribution-fill"
                      style={{
                        width: `${(count / widget.analyst_count) * 100}%`,
                        backgroundColor: colorMap[key],
                      }}
                    />
                  </div>
                  <span>{count}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}



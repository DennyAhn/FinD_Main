import { ComprehensiveValuationWidget } from '@/types'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import './ComprehensiveValuationCard.css'

interface Props {
    widget: ComprehensiveValuationWidget
}

export default function ComprehensiveValuationCard({ widget }: Props) {
    // Gauge Logic
    const percentage = Math.min(Math.max(widget.score, 0), 100)
    const gaugeData = [
        { name: 'value', value: percentage },
        { name: 'remainder', value: 100 - percentage },
    ]
    const getScoreColor = (score: number) => {
        if (score >= 80) return '#4ade80' // Green
        if (score >= 50) return '#facc15' // Yellow
        return '#f87171' // Red
    }
    const scoreColor = getScoreColor(widget.score)

    console.log('[ComprehensiveValuationCard] Widget Data:', widget)
    console.log('[ComprehensiveValuationCard] Gauge Data:', gaugeData)
    console.log('[ComprehensiveValuationCard] Score Color:', scoreColor)

    return (
        <div className="comp-val-card">
            {/* Header */}
            <div className="comp-val-header">
                <div className="comp-val-title-row">
                    <span className="comp-val-ticker">{widget.ticker}</span>
                    {widget.badges.map((badge, idx) => (
                        <span key={idx} className="comp-val-badge">{badge}</span>
                    ))}
                </div>
                <div className="comp-val-price-row">
                    <span className="comp-val-label">Valuation Analysis</span>
                </div>
            </div>

            {/* Body: Gauge + Summary */}
            <div className="comp-val-body">
                <div className="comp-val-gauge-section">
                    <div className="comp-val-gauge-container">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={gaugeData}
                                    cx="50%"
                                    cy="80%"
                                    startAngle={180}
                                    endAngle={0}
                                    innerRadius={25}
                                    outerRadius={38}
                                    paddingAngle={0}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    <Cell key="value" fill={scoreColor} />
                                    <Cell key="remainder" fill="#2d3139" />
                                </Pie>
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="comp-val-gauge-text">
                            <span className="comp-val-score" style={{ color: scoreColor }}>{widget.score}</span>
                        </div>
                    </div>
                    <div className="comp-val-status">{widget.status.toUpperCase()}</div>
                </div>

                <div className="comp-val-summary-section">
                    <div className="comp-val-summary-text">{widget.summary}</div>
                </div>
            </div>

            {/* Footer: Metrics List */}
            <div className="comp-val-footer">
                {widget.metrics.map((metric, idx) => (
                    <div key={idx} className="comp-val-metric-row">
                        <div className="comp-val-metric-label">{metric.label}</div>
                        <div className="comp-val-metric-right">
                            <div className="comp-val-metric-value">{metric.value}</div>
                            {metric.comparison && (
                                <div className="comp-val-metric-comparison">{metric.comparison}</div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

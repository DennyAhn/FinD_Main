import { SparklineCard } from '@/types'
import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts'
import './Widgets.css'

interface SparklineCardProps {
    widget: SparklineCard
}

export default function SparklineCardWidget({ widget }: SparklineCardProps) {
    const data = widget.trend_history.map((val, idx) => ({ i: idx, val }))
    const isPositive = widget.status === 'good'
    const isNegative = widget.status === 'bad'

    const color = isPositive ? '#4ade80' : isNegative ? '#f87171' : '#9ca3af'
    const statusClass = isPositive ? 'positive' : isNegative ? 'negative' : 'neutral'

    return (
        <div className="widget-card">
            <div className="widget-label">{widget.label}</div>
            <div className="widget-value-row">
                <div className="widget-value">{widget.value}</div>
                {widget.change && (
                    <div className={`widget-change ${statusClass}`}>
                        {widget.change}
                    </div>
                )}
            </div>
            <div className="widget-chart-container">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data}>
                        <Line
                            type="monotone"
                            dataKey="val"
                            stroke={color}
                            strokeWidth={2}
                            dot={false}
                        />
                        <YAxis domain={['dataMin', 'dataMax']} hide />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    )
}

import { DonutChart } from '@/types'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import './Widgets.css'

interface DonutChartProps {
    widget: DonutChart
}

export default function DonutChartWidget({ widget }: DonutChartProps) {
    return (
        <div className="widget-card" style={{ alignItems: 'center' }}>
            <div className="donut-chart-container">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={widget.segments}
                            innerRadius={35}
                            outerRadius={50}
                            paddingAngle={2}
                            dataKey="value"
                            stroke="none"
                        >
                            {widget.segments.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                        </Pie>
                        <Tooltip
                            contentStyle={{ backgroundColor: '#12141a', border: '1px solid #2d3139', borderRadius: '4px', fontSize: '12px' }}
                            itemStyle={{ color: '#fff' }}
                        />
                    </PieChart>
                </ResponsiveContainer>
                {widget.total_value && (
                    <div className="donut-center-text">
                        <span style={{ fontSize: '10px', color: 'var(--color-text-secondary)' }}>{widget.total_label}</span>
                        <span style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--color-text)' }}>{widget.total_value}</span>
                    </div>
                )}
            </div>
            <div className="donut-legend">
                {widget.segments.map((segment, idx) => (
                    <div key={idx} className="donut-legend-item">
                        <div className="donut-legend-label">
                            <div className="donut-legend-dot" style={{ backgroundColor: segment.color }} />
                            <span>{segment.label}</span>
                        </div>
                        <span style={{ fontWeight: 500, color: 'var(--color-text)' }}>{segment.value}%</span>
                    </div>
                ))}
            </div>
        </div>
    )
}

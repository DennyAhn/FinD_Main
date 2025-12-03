import { GaugeChart } from '@/types'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import './Widgets.css'

interface GaugeChartProps {
    widget: GaugeChart
}

export default function GaugeChartWidget({ widget }: GaugeChartProps) {
    // Normalize value to 0-100 for the chart
    const percentage = Math.min(Math.max(((widget.value - widget.min) / (widget.max - widget.min)) * 100, 0), 100)

    const data = [
        { name: 'value', value: percentage },
        { name: 'remainder', value: 100 - percentage },
    ]

    const getColor = (val: number) => {
        if (val >= 80) return '#4ade80' // Green
        if (val >= 50) return '#facc15' // Yellow
        return '#f87171' // Red
    }

    const color = widget.color === 'blue' ? getColor(percentage) : widget.color

    return (
        <div className="widget-card" style={{ alignItems: 'center' }}>
            <div className="donut-chart-container">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={data}
                            cx="50%"
                            cy="50%"
                            startAngle={180}
                            endAngle={0}
                            innerRadius={35}
                            outerRadius={50}
                            paddingAngle={0}
                            dataKey="value"
                            stroke="none"
                        >
                            <Cell key="value" fill={color} />
                            <Cell key="remainder" fill="#2d3139" />
                        </Pie>
                    </PieChart>
                </ResponsiveContainer>
                <div className="donut-center-text" style={{ top: '60%' }}>
                    <span style={{ fontSize: '10px', color: 'var(--color-text-secondary)' }}>{widget.label}</span>
                    <span style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--color-text)' }}>{widget.value}</span>
                </div>
            </div>
        </div>
    )
}

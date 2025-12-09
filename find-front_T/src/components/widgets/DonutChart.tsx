import { DonutChart } from '@/types'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { formatLargeNumber } from '@/utils/format'
import './Widgets.css'

interface DonutChartProps {
    widget: DonutChart
}

// [NEW] 간단한 번역 사전
const LABEL_MAP: Record<string, string> = {
    'Buyback': '자사주 매입',
    'Dividend': '배당금',
    'Capex': '설비 투자',
    'R&D': '연구 개발',
    'Acquisition': '인수 합병'
};

export default function DonutChartWidget({ widget }: DonutChartProps) {
    return (
        <div className="widget-card" style={{ alignItems: 'center', minHeight: '280px' }}>
            <div className="donut-chart-container" style={{ height: '140px', width: '100%', position: 'relative' }}>
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
                            formatter={(value: number) => formatLargeNumber(value)}
                        />
                    </PieChart>
                </ResponsiveContainer>
                {widget.total_value && (
                    <div className="donut-center-text">
                        <span style={{ fontSize: '10px', color: 'var(--color-text-secondary)' }}>{widget.total_label}</span>
                        <span style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--color-text)' }}>
                            {formatLargeNumber(widget.total_value)}
                        </span>
                    </div>
                )}
            </div>
            <div className="donut-legend">
                {widget.segments.map((segment, idx) => (
                    <div key={idx} className="donut-legend-item">
                        <div className="donut-legend-label">
                            <div className="donut-legend-dot" style={{ backgroundColor: segment.color }} />
                            <span>{segment.label}</span>
                            {/* [NEW] 한글 번역 추가 */}
                            {LABEL_MAP[segment.label] && (
                                <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginLeft: '4px' }}>
                                    ({LABEL_MAP[segment.label]})
                                </span>
                            )}
                        </div>
                        <span style={{ fontWeight: 500, color: 'var(--color-text)' }}>
                            {formatLargeNumber(segment.value)}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    )
}

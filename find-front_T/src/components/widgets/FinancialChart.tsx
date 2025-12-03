import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import type { FinancialChartWidget } from '@/types'
import './Widgets.css'

interface Props {
  widget: FinancialChartWidget
}

const formatYAxisUSD = (value: number) => {
  if (!Number.isFinite(value)) return '0'
  if (Math.abs(value) >= 1e12) return `${(value / 1e12).toFixed(1)}T`
  if (Math.abs(value) >= 1e9) return `${(value / 1e9).toFixed(1)}B`
  if (Math.abs(value) >= 1e6) return `${(value / 1e6).toFixed(1)}M`
  return `${(value / 1e3).toFixed(0)}K`
}

const formatYAxisPercent = (value: number) => {
  if (!Number.isFinite(value)) return '0%'
  return `${value.toFixed(1)}%`
}

const formatTooltip = (value: number, name: string) => {
  if (name === 'Net Margin' || name.includes('%')) {
    return `${value.toFixed(2)}%`
  }
  return formatYAxisUSD(value)
}

export default function FinancialChart({ widget }: Props) {
  const leftAxisSeries = widget.series.filter((s) => s.axis === 'left')
  const rightAxisSeries = widget.series.filter((s) => s.axis === 'right')

  return (
    <div className="financial-chart-widget">
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={widget.data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey={widget.x_key} tick={{ fill: 'var(--color-text-secondary)' }} />
          <YAxis
            yAxisId="left"
            tickFormatter={formatYAxisUSD}
            tick={{ fill: 'var(--color-text-secondary)' }}
          />
          {rightAxisSeries.length > 0 && (
            <YAxis
              yAxisId="right"
              orientation="right"
              tickFormatter={formatYAxisPercent}
              tick={{ fill: 'var(--color-text-secondary)' }}
            />
          )}
          <Tooltip
            formatter={formatTooltip}
            labelStyle={{ color: 'var(--color-text)' }}
            contentStyle={{ backgroundColor: '#1e2127', border: '1px solid rgba(255,255,255,0.1)' }}
          />
          <Legend />
          {leftAxisSeries.map((series) => {
            if (series.type === 'bar') {
              return (
                <Bar
                  key={series.id}
                  yAxisId="left"
                  dataKey={series.value_key}
                  name={series.label}
                  fill={series.color}
                  radius={[4, 4, 0, 0]}
                />
              )
            }
            if (series.type === 'line') {
              return (
                <Line
                  key={series.id}
                  yAxisId="left"
                  dataKey={series.value_key}
                  name={series.label}
                  stroke={series.color}
                  type="monotone"
                />
              )
            }
            return null
          })}
          {rightAxisSeries.map((series) => {
            if (series.type === 'line') {
              return (
                <Line
                  key={series.id}
                  yAxisId="right"
                  dataKey={series.value_key}
                  name={series.label}
                  stroke={series.color}
                  type="monotone"
                />
              )
            }
            return null
          })}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}


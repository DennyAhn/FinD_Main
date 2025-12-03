import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import type { FinancialMetric } from '@/types'
import './FinancialChart.css'

interface FinancialChartProps {
  data: FinancialMetric[]
  dataKey: keyof FinancialMetric
  name: string
  color?: string
}

export default function FinancialChart({ data, dataKey, name, color = '#2563eb' }: FinancialChartProps) {
  const chartData = data
    .filter((item) => item[dataKey] !== null && item[dataKey] !== undefined)
    .map((item) => ({
      date: item.report_date,
      value: item[dataKey],
    }))
    .reverse()

  if (chartData.length === 0) {
    return <div className="chart-empty">데이터가 없습니다.</div>
  }

  return (
    <div className="financial-chart">
      <h3>{name}</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}


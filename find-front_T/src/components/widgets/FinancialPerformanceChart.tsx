import { useEffect, useMemo, useState } from 'react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import { companyApi } from '@/services/api/company'
import type { IncomeStatement } from '@/types'

interface Props {
  ticker: string
}

const USD_TO_KRW = 1460

const formatHundredMillionUSD = (value: number) => {
  if (!Number.isFinite(value)) return '0억 달러'
  return `${(value / 1e8).toFixed(1)}억 달러`
}

const formatYAxisUSD = (value: number) => {
  if (!Number.isFinite(value)) return '0'
  if (Math.abs(value) >= 1e12) return `${(value / 1e12).toFixed(1)}T`
  if (Math.abs(value) >= 1e9) return `${(value / 1e9).toFixed(1)}B`
  if (Math.abs(value) >= 1e6) return `${(value / 1e6).toFixed(1)}M`
  return `${(value / 1e3).toFixed(0)}K`
}

const formatKrwDisplay = (value: number) => {
  const won = value * USD_TO_KRW
  if (Math.abs(won) >= 1e14) return `≈${(won / 1e14).toFixed(1)}백조원`
  if (Math.abs(won) >= 1e12) return `≈${(won / 1e12).toFixed(1)}조원`
  if (Math.abs(won) >= 1e8) return `≈${(won / 1e8).toFixed(1)}억원`
  return `≈${(won / 1e4).toFixed(1)}만원`
}

export default function FinancialPerformanceChart({ ticker }: Props) {
  const [statements, setStatements] = useState<IncomeStatement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!ticker) return
    setLoading(true)
    setError(null)
    companyApi
      .getIncomeStatements(ticker, 'annual', 6)
      .then((data) => setStatements(data || []))
      .catch(() => setError('데이터를 불러오지 못했습니다.'))
      .finally(() => setLoading(false))
  }, [ticker])

  const chartData = useMemo(() => {
    if (!statements.length) return []
    const sorted = [...statements].reverse()
    return sorted.map((item, index) => {
      const revenue = item.revenue ?? 0
      const netIncome = item.net_income ?? 0
      const prev = sorted[index - 1]
      const prevRevenue = prev?.revenue ?? null
      const prevNetIncome = prev?.net_income ?? null
      const yoyRevenue =
        prevRevenue && prevRevenue !== 0 ? ((revenue - prevRevenue) / prevRevenue) * 100 : null
      const yoyNetIncome =
        prevNetIncome && prevNetIncome !== 0
          ? ((netIncome - prevNetIncome) / prevNetIncome) * 100
          : null

      return {
        period: item.report_year?.toString() ?? item.report_date?.slice(0, 4) ?? 'N/A',
        revenue,
        netIncome,
        yoyRevenue,
        yoyNetIncome,
      }
    })
  }, [statements])

  const latestPoint = chartData[chartData.length - 1]

  const formatPercent = (value: number | null | undefined) => {
    if (value === null || value === undefined || Number.isNaN(value)) return 'N/A'
    const formatted = `${value > 0 ? '+' : ''}${value.toFixed(1)}%`
    return formatted
  }

  if (loading) {
    return <div className="financial-chart-empty">재무 데이터를 불러오는 중...</div>
  }

  if (error || !chartData.length) {
    return <div className="financial-chart-empty">{error || '표시할 데이터가 없습니다.'}</div>
  }

  return (
    <div className="financial-chart-container">
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={chartData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey="period" tick={{ fill: 'var(--color-text-secondary)' }} />
          <YAxis
            tickFormatter={(value) => formatYAxisUSD(value as number)}
            tick={{ fill: 'var(--color-text-secondary)' }}
          />
          <Tooltip
            formatter={(value: number, name, props) => {
              const payload = props?.payload
              const yoyValue =
                name === '매출' ? payload?.yoyRevenue : name === '순이익' ? payload?.yoyNetIncome : null
              const valueStr = `${formatHundredMillionUSD(value)} (${formatKrwDisplay(value)})`
              return yoyValue !== undefined && yoyValue !== null
                ? [valueStr, `${name} (${formatPercent(yoyValue)})`]
                : [valueStr, name]
            }}
            labelStyle={{ color: 'var(--color-text)' }}
            contentStyle={{ backgroundColor: '#1e2127', border: '1px solid rgba(255,255,255,0.1)' }}
          />
          <Legend />
          <Bar dataKey="revenue" name="매출" fill="#34d399" radius={[4, 4, 0, 0]} />
          <Bar dataKey="netIncome" name="순이익" fill="#60a5fa" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
      {latestPoint && (
        <div className="financial-chart-summary">
          <div className="financial-chart-summary-item">
            <span>매출 YoY</span>
            <strong className={latestPoint.yoyRevenue && latestPoint.yoyRevenue >= 0 ? 'up' : 'down'}>
              {formatPercent(latestPoint.yoyRevenue)}
            </strong>
          </div>
          <div className="financial-chart-summary-item">
            <span>순이익 YoY</span>
            <strong
              className={latestPoint.yoyNetIncome && latestPoint.yoyNetIncome >= 0 ? 'up' : 'down'}
            >
              {formatPercent(latestPoint.yoyNetIncome)}
            </strong>
          </div>
        </div>
      )}
    </div>
  )
}


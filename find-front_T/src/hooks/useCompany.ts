import { useState, useEffect } from 'react'
import { companyApi } from '@/services/api/company'
import type { Company, StockQuote, FinancialMetric } from '@/types'

export function useCompany(ticker: string) {
  const [company, setCompany] = useState<Company | null>(null)
  const [quote, setQuote] = useState<StockQuote | null>(null)
  const [metrics, setMetrics] = useState<FinancialMetric[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!ticker) return

    setLoading(true)
    setError(null)

    Promise.all([
      companyApi.getProfile(ticker).catch(() => {
        setError('프로필을 불러올 수 없습니다.')
        return null
      }),
      companyApi.getQuote(ticker).catch(() => null),
      companyApi.getKeyMetrics(ticker)
        .then((r) => r.records)
        .catch(() => []),
    ]).then(([profile, quoteData, metricsData]) => {
      setCompany(profile)
      setQuote(quoteData)
      setMetrics(metricsData)
      setLoading(false)
    })
  }, [ticker])

  return { company, quote, metrics, loading, error }
}


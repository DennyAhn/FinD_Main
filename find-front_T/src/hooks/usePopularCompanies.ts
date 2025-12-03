import { useState, useEffect, useRef } from 'react'
import { companyApi } from '@/services/api/company'
import type { Company, StockQuote } from '@/types'
import { POPULAR_TICKERS } from '@/constants'

/**
 * 인기 기업 목록과 주가 정보를 로드하는 커스텀 훅
 */
export function usePopularCompanies() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [quotes, setQuotes] = useState<Record<string, StockQuote>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const hasLoadedRef = useRef(false)

  useEffect(() => {
    // 중복 요청 방지
    if (hasLoadedRef.current) return
    hasLoadedRef.current = true

    const loadData = async () => {
      setLoading(true)
      setError(null)

      try {
        const results = await Promise.allSettled(
          POPULAR_TICKERS.map(async (ticker) => {
            const [profileResult, quoteResult] = await Promise.allSettled([
              companyApi.getProfile(ticker),
              companyApi.getQuote(ticker),
            ])

            return {
              ticker,
              profile: profileResult.status === 'fulfilled' ? profileResult.value : null,
              quote: quoteResult.status === 'fulfilled' ? quoteResult.value : null,
            }
          })
        )

        const successfulResults = results
          .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
          .map((r) => r.value)

        const profiles: Company[] = []
        const quotesMap: Record<string, StockQuote> = {}

        successfulResults.forEach((result) => {
          if (result.profile) {
            profiles.push(result.profile)
          }
          if (result.quote) {
            quotesMap[result.ticker] = result.quote
          }
        })

        setCompanies(profiles)
        setQuotes(quotesMap)

        if (profiles.length === 0) {
          setError('데이터를 불러올 수 없습니다.')
        }
      } catch (err: any) {
        console.error('Popular companies load error:', err)
        setError('데이터를 불러오는 중 오류가 발생했습니다.')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  return { companies, quotes, loading, error }
}


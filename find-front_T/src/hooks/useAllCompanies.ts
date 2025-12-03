import { useState, useEffect, useRef } from 'react'
import { companyApi } from '@/services/api/company'
import type { Company, StockQuote } from '@/types'
import { isUSMarketOpen, type MarketStatus } from '@/utils/marketHours'
import { useMarketStore } from '@/store/useMarketStore'
import { NASDAQ_TICKERS, DOW_TICKERS, SP500_TICKERS } from '@/constants'

/**
 * DB에 있는 모든 기업 목록을 로드하는 커스텀 훅
 * 주가는 점진적으로 로딩 (처음 20개 → 나머지)
 * 
 * 실시간 업데이트:
 * - 미국 장 중: 30초마다 자동 업데이트
 * - 장 마감: 마감가 유지
 * 
 * 증시 필터:
 * - selectedMarket에 따라 표시할 기업 필터링
 */
export function useAllCompanies(limit: number = 100) {
  const { selectedMarket } = useMarketStore()
  const [allCompanies, setAllCompanies] = useState<Company[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [quotes, setQuotes] = useState<Record<string, StockQuote>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [marketStatus, setMarketStatus] = useState<MarketStatus>(isUSMarketOpen())
  const hasLoadedRef = useRef(false)

  useEffect(() => {
    // 중복 요청 방지
    if (hasLoadedRef.current) return
    hasLoadedRef.current = true

    const loadData = async () => {
      setLoading(true)
      setError(null)

      try {
        // 1단계: 모든 기업 프로필 가져오기
        const fetchedCompanies = await companyApi.getAllCompanies(limit)
        setAllCompanies(fetchedCompanies)
        setCompanies(fetchedCompanies) // 초기에는 전체 표시

        if (fetchedCompanies.length === 0) {
          setError('데이터를 불러올 수 없습니다.')
          setLoading(false)
          return
        }

        // 2단계: 처음 20개 주가 빠르게 로딩
        const firstBatch = fetchedCompanies.slice(0, 20)
        const firstQuotes = await loadQuoteBatch(firstBatch)
        setQuotes(firstQuotes)
        setLoading(false) // 초기 로딩 완료!

        // 3단계: 나머지 주가 배치로 로딩 (10개씩)
        const remaining = fetchedCompanies.slice(20)
        await loadRemainingQuotes(remaining, firstQuotes)

      } catch (err: any) {
        console.error('All companies load error:', err)
        setError('데이터를 불러오는 중 오류가 발생했습니다.')
        setLoading(false)
      }
    }

    // 배치 단위로 주가 로딩
    const loadQuoteBatch = async (companies: Company[]): Promise<Record<string, StockQuote>> => {
      const tickers = companies.map(c => c.ticker)
      const quoteResults = await Promise.allSettled(
        tickers.map(ticker => companyApi.getQuote(ticker))
      )

      const quotesMap: Record<string, StockQuote> = {}
      quoteResults.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          quotesMap[tickers[index]] = result.value
        }
      })

      return quotesMap
    }

    // 나머지 주가 점진적으로 로딩
    const loadRemainingQuotes = async (
      remaining: Company[], 
      initialQuotes: Record<string, StockQuote>
    ) => {
      const batchSize = 10 // 한 번에 10개씩
      let currentQuotes = { ...initialQuotes }

      for (let i = 0; i < remaining.length; i += batchSize) {
        const batch = remaining.slice(i, i + batchSize)
        
        // 배치 로딩
        const batchQuotes = await loadQuoteBatch(batch)
        
        // 상태 업데이트
        currentQuotes = { ...currentQuotes, ...batchQuotes }
        setQuotes(currentQuotes)
        
        // 마지막 배치가 아니면 잠깐 대기 (서버 부하 분산)
        if (i + batchSize < remaining.length) {
          await new Promise(resolve => setTimeout(resolve, 500))
        }
      }
    }

    loadData()
  }, [limit])

  // 증시 필터가 변경되면 기업 목록 필터링
  useEffect(() => {
    if (allCompanies.length === 0) return

    let filteredTickers: readonly string[]

    switch (selectedMarket) {
      case 'NASDAQ':
        filteredTickers = NASDAQ_TICKERS
        break
      case 'DOW':
        filteredTickers = DOW_TICKERS
        break
      case 'SP500':
        filteredTickers = SP500_TICKERS
        break
      case 'ALL':
      default:
        setCompanies(allCompanies)
        return
    }

    const filtered = allCompanies.filter(company => 
      filteredTickers.includes(company.ticker as any)
    )
    setCompanies(filtered)
  }, [selectedMarket, allCompanies])

  // 실시간 주가 업데이트 (장 중에만)
  useEffect(() => {
    // 초기 로딩 중이거나 회사 데이터가 없으면 스킵
    if (loading || companies.length === 0) return

    // 주가 새로고침 함수
    const refreshQuotes = async () => {
      try {
        const tickers = companies.map(c => c.ticker)
        const quoteResults = await Promise.allSettled(
          tickers.map(ticker => companyApi.getQuote(ticker))
        )

        const updatedQuotes: Record<string, StockQuote> = {}
        quoteResults.forEach((result, index) => {
          if (result.status === 'fulfilled' && result.value) {
            updatedQuotes[tickers[index]] = result.value
          }
        })

        setQuotes(prev => ({ ...prev, ...updatedQuotes }))
        console.log(`[실시간 업데이트] ${Object.keys(updatedQuotes).length}개 주가 갱신`)
      } catch (err) {
        console.error('주가 업데이트 실패:', err)
      }
    }

    // 마켓 상태 체크 함수
    const checkMarketStatus = () => {
      const status = isUSMarketOpen()
      setMarketStatus(status)
      console.log(`[마켓 상태] ${status.message}`)
      return status.isOpen
    }

    // 초기 상태 체크
    const isOpen = checkMarketStatus()

    let quoteInterval: ReturnType<typeof setInterval> | null = null
    let statusInterval: ReturnType<typeof setInterval> | null = null

    if (isOpen) {
      // 장 중: 30초마다 주가 업데이트
      quoteInterval = setInterval(refreshQuotes, 30000)
      console.log('[실시간 모드] 30초마다 주가 업데이트 시작')
    }

    // 1분마다 마켓 상태 체크 (장 오픈/마감 감지)
    statusInterval = setInterval(() => {
      const newStatus = checkMarketStatus()
      
      // 장이 열렸을 때: 업데이트 시작
      if (newStatus && !quoteInterval) {
        quoteInterval = setInterval(refreshQuotes, 30000)
        refreshQuotes() // 즉시 1회 업데이트
        console.log('[장 오픈] 실시간 업데이트 시작')
      }
      
      // 장이 닫혔을 때: 업데이트 중단
      if (!newStatus && quoteInterval) {
        clearInterval(quoteInterval)
        quoteInterval = null
        console.log('[장 마감] 실시간 업데이트 중단')
      }
    }, 60000) // 1분마다

    // Cleanup
    return () => {
      if (quoteInterval) clearInterval(quoteInterval)
      if (statusInterval) clearInterval(statusInterval)
    }
  }, [loading, companies])

  return { companies, quotes, loading, error, marketStatus }
}

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { companyApi } from '@/services/api/company'
import { searchApi } from '@/services/api/search'
import { useMarketStore } from '@/store/useMarketStore'
import { isUSMarketOpen } from '@/utils/marketHours'
import type { Company, StockQuote, FinancialMetric, AnalystCardWidget, MetricsGridWidget } from '@/types'
import { useAllCompanies } from '@/hooks/useAllCompanies'
import { COMPANY_DETAIL_TABS } from '@/constants'
import CompanyCard from '@/components/company/CompanyCard'
import SkeletonCard from '@/components/company/SkeletonCard'
import Loading from '@/components/common/Loading'
import AnalystCard from '@/components/widgets/AnalystCard'
import MetricsGrid from '@/components/widgets/MetricsGrid'
import FinancialPerformanceChart from '@/components/widgets/FinancialPerformanceChart'
import FinancialStatementsView from '@/components/widgets/FinancialStatementsView'
import { AdvancedChartWidget } from '@/widgets/advanced-chart'
import './CompanyDetail.css'
import '../Dashboard/Dashboard.css'

// 카드 애니메이션 variants
const cardVariants = {
  hidden: {
    opacity: 0,
    y: 20
  },
  visible: (index: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: [0.4, 0, 0.2, 1] as const, // cubic-bezier for easeOut
      delay: index * 0.05
    }
  })
}

export default function CompanyDetail() {
  const { ticker } = useParams<{ ticker: string }>()
  const navigate = useNavigate()
  const { selectedMarket } = useMarketStore()
  const [company, setCompany] = useState<Company | null>(null)
  const [quote, setQuote] = useState<StockQuote | null>(null)
  const [metrics, setMetrics] = useState<FinancialMetric[]>([])
  const [insiderTrades, setInsiderTrades] = useState<any[]>([])

  // [NEW] Widget States
  const [analystWidget, setAnalystWidget] = useState<AnalystCardWidget | null>(null)
  const [metricsWidget, setMetricsWidget] = useState<MetricsGridWidget | null>(null)

  const [activeTab, setActiveTab] = useState('overview')
  const [detailLoading, setDetailLoading] = useState(false)

  // 대시보드용 상태
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Company[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchQuotes, setSearchQuotes] = useState<Record<string, StockQuote>>({})

  const {
    companies: dashboardCompanies,
    quotes: dashboardQuotes,
    loading: dashboardLoading
  } = useAllCompanies(50)

  // 선택된 마켓에 따른 제목 텍스트
  const getMarketTitle = () => {
    switch (selectedMarket) {
      case 'NASDAQ':
        return 'NASDAQ 100'
      case 'DOW':
        return '다우 30'
      case 'SP500':
        return 'S&P 500'
      case 'ALL':
      default:
        return '인기 기업'
    }
  }

  // ESC 키로 뒤로가기
  useEffect(() => {
    const handleEscKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        navigate(-1)
      }
    }

    window.addEventListener('keydown', handleEscKey)
    return () => window.removeEventListener('keydown', handleEscKey)
  }, [navigate])

  // ticker가 변경될 때마다 항상 'overview' 탭으로 리셋
  useEffect(() => {
    setActiveTab('overview')
  }, [ticker])

  // 초기 데이터 로드
  useEffect(() => {
    if (!ticker) {
      setDetailLoading(false)
      return
    }

    setDetailLoading(true)
    setCompany(null)
    setQuote(null)
    setMetrics([])
    setInsiderTrades([])
    setAnalystWidget(null)
    setMetricsWidget(null)

    Promise.all([
      companyApi.getProfile(ticker).catch(() => null),
      companyApi.getQuote(ticker).catch(() => null),
      companyApi.getKeyMetrics(ticker).then((r) => r.records).catch(() => []),
      companyApi.getInsiderTrades(ticker).catch(() => []),
      // [NEW] Fetch Widgets
      companyApi.getAnalystConsensusWidget(ticker).catch(() => null),
      companyApi.getMetricsGridWidget(ticker).catch(() => null),
    ]).then(([profile, quoteData, metricsData, insiderData, analystData, metricsGridData]) => {
      setCompany(profile)
      setQuote(quoteData)
      setMetrics(metricsData)
      setInsiderTrades(insiderData)
      setAnalystWidget(analystData)
      setMetricsWidget(metricsGridData)
      setDetailLoading(false)
    })
  }, [ticker])

  // 실시간 주가 업데이트 (장 중에만)
  useEffect(() => {
    if (!ticker || detailLoading || !quote) return

    // 주가 새로고침 함수
    const refreshQuote = async () => {
      try {
        const quoteData = await companyApi.getQuote(ticker)
        if (quoteData) {
          setQuote(quoteData)
          console.log(`[기업 세부] ${ticker} 주가 갱신: $${quoteData.price.toFixed(2)}`)
        }
      } catch (err) {
        console.error(`[기업 세부] ${ticker} 주가 업데이트 실패:`, err)
      }
    }

    // 마켓 상태 체크 함수
    const checkMarketStatus = () => {
      const status = isUSMarketOpen()
      return status.isOpen
    }

    // 초기 상태 체크
    const isOpen = checkMarketStatus()

    let quoteInterval: ReturnType<typeof setInterval> | null = null
    let statusInterval: ReturnType<typeof setInterval> | null = null

    if (isOpen) {
      // 장 중: 30초마다 주가 업데이트
      quoteInterval = setInterval(refreshQuote, 30000)
      console.log(`[기업 세부] ${ticker} 실시간 업데이트 시작 (30초 주기)`)
    }

    // 1분마다 마켓 상태 체크 (장 오픈/마감 감지)
    statusInterval = setInterval(() => {
      const newStatus = checkMarketStatus()
      
      // 장이 열렸을 때: 업데이트 시작
      if (newStatus && !quoteInterval) {
        quoteInterval = setInterval(refreshQuote, 30000)
        refreshQuote() // 즉시 1회 업데이트
        console.log(`[기업 세부] ${ticker} 장 오픈 - 실시간 업데이트 시작`)
      }
      
      // 장이 닫혔을 때: 업데이트 중단
      if (!newStatus && quoteInterval) {
        clearInterval(quoteInterval)
        quoteInterval = null
        console.log(`[기업 세부] ${ticker} 장 마감 - 실시간 업데이트 중단`)
      }
    }, 60000) // 1분마다

    // Cleanup
    return () => {
      if (quoteInterval) clearInterval(quoteInterval)
      if (statusInterval) clearInterval(statusInterval)
    }
  }, [ticker, detailLoading, quote])

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return

    setSearchLoading(true)
    try {
      const data = await searchApi.searchCompany(searchQuery)
      setSearchResults(data)

      const quotePromises = data.map((comp) =>
        companyApi.getQuote(comp.ticker).catch(() => null)
      )
      const quoteResults = await Promise.allSettled(quotePromises)

      const newQuotes: Record<string, StockQuote> = {}
      quoteResults.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          newQuotes[data[index].ticker] = result.value
        }
      })

      setSearchQuotes(newQuotes)
    } catch (error) {
      console.error('❌ Search error:', error)
      setSearchResults([])
    } finally {
      setSearchLoading(false)
    }
  }, [searchQuery])

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      return
    }
    const timer = setTimeout(() => {
      handleSearch()
    }, 500)
    return () => clearTimeout(timer)
  }, [searchQuery, handleSearch])

  const handleCompanyClick = (t: string) => {
    navigate(`/company/${t}`)
  }

  const calculateHealthScore = useCallback(() => {
    if (!metrics || metrics.length === 0) return null
    const latest = metrics[0]

    let profitability = 5
    if (latest.return_on_equity) {
      const roe = latest.return_on_equity * 100
      if (roe > 20) profitability = 10
      else if (roe > 15) profitability = 8
      else if (roe > 10) profitability = 6
      else if (roe > 5) profitability = 4
      else profitability = 2
    }

    let stability = 5
    if (latest.debt_to_equity) {
      const de = latest.debt_to_equity
      if (de < 0.5) stability = 10
      else if (de < 1.0) stability = 8
      else if (de < 1.5) stability = 6
      else if (de < 2.0) stability = 4
      else stability = 2
    }

    let growth = 5
    if (latest.peg_ratio) {
      const peg = latest.peg_ratio
      if (peg < 1.0 && peg > 0) growth = 10
      else if (peg < 1.5) growth = 8
      else if (peg < 2.0) growth = 6
      else if (peg < 3.0) growth = 4
      else growth = 2
    } else if (latest.price_to_book_ratio) {
      if (latest.price_to_book_ratio > 5) growth = 8
      else if (latest.price_to_book_ratio > 3) growth = 6
    }

    const total = Math.round(((profitability + stability + growth) / 30) * 100)
    return { total, profitability, stability, growth }
  }, [metrics])

  const healthScore = calculateHealthScore()

  const insiderStats = useMemo(() => {
    if (!insiderTrades.length) return null

    const classifyTrade = (type?: string) => {
      if (!type) return 'neutral'
      const normalized = type.toLowerCase()

      const buyCodes = ['p', 'b', 'm', 'a']
      const buyKeywords = ['buy', 'acq', 'purchase', 'award', 'grant']
      if (buyCodes.some((code) => normalized.startsWith(code))) {
        return 'buy'
      }
      if (buyKeywords.some((kw) => normalized.includes(kw))) {
        return 'buy'
      }

      const sellCodes = ['s', 'f', 'g']
      const sellKeywords = ['sale', 'sell', 'in-kind', 'inkind', 'gift']
      if (sellCodes.some((code) => normalized.startsWith(code))) {
        return 'sell'
      }
      if (sellKeywords.some((kw) => normalized.includes(kw))) {
        return 'sell'
      }

      return 'neutral'
    }

    let buyVol = 0
    let sellVol = 0
    insiderTrades.forEach((trade) => {
      const category = classifyTrade(trade.type)
      const volume = trade.volume || 0
      if (category === 'buy') buyVol += volume
      else if (category === 'sell') sellVol += volume
    })

    const netVol = buyVol - sellVol
    const totalVolume = buyVol + sellVol
    const buyRatio = totalVolume > 0 ? Math.round((buyVol / totalVolume) * 100) : 50
    const sellRatio = 100 - buyRatio

    let status = 'neutral'
    let statusLabel = '중립'
    if (netVol > 0) {
      status = 'positive'
      statusLabel = '매수 우위'
    } else if (netVol < 0) {
      status = 'negative'
      statusLabel = '매도 우위'
    }

    return {
      buyVol,
      sellVol,
      netVol,
      buyRatio,
      sellRatio,
      status,
      statusLabel,
      tradeCount: insiderTrades.length,
    }
  }, [insiderTrades])

  if (!ticker) {
    return (
      <div className="company-detail">
        <div className="company-search-section">
          <div className="company-search-container">
            <div className="company-search-input-wrapper">
              <svg className="company-search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="기업명 또는 티커를 입력하세요 (예: 애플, AAPL)"
                className="company-search-input"
              />
              <div className="company-search-shortcut">
                <span className="company-search-shortcut-key">⌘</span>
                <span className="company-search-shortcut-key">K</span>
              </div>
            </div>
            <button
              onClick={handleSearch}
              className="company-search-button"
              disabled={searchLoading}
            >
              {searchLoading ? '검색 중...' : '검색'}
            </button>
          </div>

          {searchQuery.trim() && !searchLoading && searchResults.length > 0 && (
            <div className="company-search-results">
              <h3 className="company-search-results-title">검색 결과 ({searchResults.length}개)</h3>
              <div className="dashboard-grid">
                {searchResults.map((comp, index) => (
                  <motion.div
                    key={comp.ticker}
                    variants={cardVariants}
                    initial="hidden"
                    animate="visible"
                    custom={index}
                  >
                    <CompanyCard
                      company={comp}
                      quote={searchQuotes[comp.ticker]}
                      onClick={() => handleCompanyClick(comp.ticker)}
                    />
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {searchQuery.trim() && !searchLoading && searchResults.length === 0 && (
            <div className="company-search-results">
              <div className="search-no-results">
                <div className="no-results-icon">🔍</div>
                <div className="no-results-text">검색 결과가 없습니다</div>
                <div className="no-results-hint">다른 검색어를 입력해보세요</div>
              </div>
            </div>
          )}

          {!searchQuery.trim() && (
            <>
              {dashboardLoading ? (
                <div className="company-dashboard-section">
                  <h2 className="company-dashboard-title">{getMarketTitle()}</h2>
                  <div className="dashboard-grid">
                    {Array.from({ length: 8 }).map((_, index) => (
                      <SkeletonCard key={index} />
                    ))}
                  </div>
                </div>
              ) : dashboardCompanies.length > 0 ? (
                <div className="company-dashboard-section">
                  <h2 className="company-dashboard-title">{getMarketTitle()}</h2>
                  <div className="dashboard-grid">
                    {dashboardCompanies.map((comp, index) => (
                      <motion.div
                        key={comp.ticker}
                        variants={cardVariants}
                        initial="hidden"
                        animate="visible"
                        custom={index}
                      >
                        <CompanyCard
                          company={comp}
                          quote={dashboardQuotes[comp.ticker]}
                          onClick={() => handleCompanyClick(comp.ticker)}
                        />
                      </motion.div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="company-loading">
                  <div className="search-no-results">
                    <div className="no-results-icon">📊</div>
                    <div className="no-results-text">데이터를 불러올 수 없습니다</div>
                    <div className="no-results-hint">잠시 후 다시 시도해주세요</div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    )
  }

  if (ticker && (detailLoading || !company || company.ticker !== ticker)) {
    return (
      <div className="company-loading">
        <Loading />
      </div>
    )
  }

  if (!ticker || !company) {
    return null
  }

  return (
    <div className="company-detail">
      <div className="company-header">
        <div className="company-header-left">
          {/* 뒤로가기 아이콘 버튼 */}
          <button
            onClick={() => navigate(-1)}
            className="back-button-icon"
            title="뒤로가기 (ESC)"
          >
            <svg className="back-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {company.logo_url && (
            <img
              src={company.logo_url}
              alt={`${company.companyName} logo`}
              className="company-logo-clean"
              onError={(e) => {
                e.currentTarget.src = 'https://via.placeholder.com/48/00000000/e8e9ed?text=' +
                  (company.ticker?.charAt(0) || '?')
              }}
            />
          )}
          <div className="company-info-modern">
            {company.k_name ? (
              <>
                <h1 className="company-name-primary">{company.k_name}</h1>
                <div className="company-title-row">
                  <span className="company-name-secondary">{company.companyName}</span>
                  <span className="company-ticker-badge">{ticker}</span>
                </div>
              </>
            ) : (
              <div className="company-title-row">
                <h1 className="company-name-primary">{company.companyName}</h1>
                <span className="company-ticker-badge">{ticker}</span>
              </div>
            )}
          </div>
        </div>
        <div className="company-header-right">
          {quote && (
            <div className="company-price-info">
              <div className="company-price">${quote.price.toFixed(2)}</div>
              <div className={`company-change ${quote.change >= 0 ? 'positive' : 'negative'}`}>
                {quote.change >= 0 ? '▲' : '▼'}${Math.abs(quote.change).toFixed(2)} ({quote.changePercent >= 0 ? '+' : ''}{quote.changePercent.toFixed(2)}%)
              </div>
            </div>
          )}
          <button className="company-favorite" title="즐겨찾기에 추가">
            ⭐
          </button>
        </div>
      </div>

      <nav className="company-tabs">
        {COMPANY_DETAIL_TABS.map((tab) => (
          <button
            key={tab.id}
            className={`company-tab-item ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="company-content">
        {activeTab === 'overview' && (
          <div key="overview-tab" className="tab-content-wrapper">
            <>
            <section className="hero-section">
              <div className="health-score-container">
                <h2 className="health-score-title">재무 건전성 분석</h2>
                {healthScore ? (
                  <>
                    <div className="health-score-circle">
                      <div className="score-number">{healthScore.total}</div>
                      <div className="score-max">/ 100</div>
                    </div>
                    <div className="health-bars">
                      <div className="health-bar-item">
                        <div className="bar-label">
                          <span>수익성</span>
                          <span className="bar-score">{healthScore.profitability}/10</span>
                        </div>
                        <div className="bar-track">
                          <div className="bar-fill profitability" style={{ width: `${healthScore.profitability * 10}%` }}></div>
                        </div>
                      </div>
                      <div className="health-bar-item">
                        <div className="bar-label">
                          <span>성장성</span>
                          <span className="bar-score">{healthScore.growth}/10</span>
                        </div>
                        <div className="bar-track">
                          <div className="bar-fill growth" style={{ width: `${healthScore.growth * 10}%` }}></div>
                        </div>
                      </div>
                      <div className="health-bar-item">
                        <div className="bar-label">
                          <span>안정성</span>
                          <span className="bar-score">{healthScore.stability}/10</span>
                        </div>
                        <div className="bar-track">
                          <div className="bar-fill stability" style={{ width: `${healthScore.stability * 10}%` }}></div>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="health-score-empty">데이터 부족</div>
                )}
                <p className="health-disclaimer">
                  ※ 이 점수는 재무지표 기반 분석이며, 투자 조언이 아닙니다.
                </p>
              </div>
              <div className="company-overview">
                <h3 className="overview-title">기업 개요</h3>
                <p className="company-description">{company.description || '기업 설명이 없습니다.'}</p>
              </div>
            </section>

            <div className="dashboard-layout">
              <section className="key-metrics-section">
                <h2 className="section-title">핵심 지표</h2>
                {metricsWidget ? (
                  <MetricsGrid widget={metricsWidget} />
                ) : (
                  <div className="metrics-loading">데이터 로딩 중...</div>
                )}
              </section>

              {analystWidget && (
                <section className="analyst-section analyst-wide">
                  <div className="section-header">
                    <div>
                      <p className="section-eyebrow">Analyst Insight</p>
                      <h2 className="section-title">애널리스트 컨센서스</h2>
                    </div>
                    <span className="section-pill">최근 업데이트</span>
                  </div>
                  <AnalystCard widget={analystWidget} />
                </section>
              )}

              <section className="insider-section">
                <div className="section-header">
                  <div>
                    <p className="section-eyebrow">Insider Flow</p>
                    <h2 className="section-title">내부자 거래 (최근 3개월)</h2>
                  </div>
                  {insiderStats && (
                    <span className="section-pill">{insiderStats.tradeCount}건</span>
                  )}
                </div>
                <div className="insider-summary">
                  {insiderStats ? (
                    <>
                      <div className="insider-status-row">
                        <span className={`insider-pill ${insiderStats.status}`}>
                          {insiderStats.statusLabel}
                        </span>
                        <span className="insider-net">
                          순변동 {insiderStats.netVol >= 0 ? '+' : '-'}
                          {Math.abs(insiderStats.netVol).toLocaleString()}주
                        </span>
                      </div>
                      <div className="insider-progress">
                        <div className="insider-progress-row">
                          <span>매수</span>
                          <div className="insider-progress-track">
                            <div
                              className="insider-progress-fill buy"
                              style={{ width: `${insiderStats.buyRatio}%` }}
                            />
                          </div>
                          <span>{insiderStats.buyVol.toLocaleString()}주</span>
                        </div>
                        <div className="insider-progress-row">
                          <span>매도</span>
                          <div className="insider-progress-track">
                            <div
                              className="insider-progress-fill sell"
                              style={{ width: `${insiderStats.sellRatio}%` }}
                            />
                          </div>
                          <span>{insiderStats.sellVol.toLocaleString()}주</span>
                        </div>
                      </div>
                      {insiderTrades.length > 0 && (
                        <div className="insider-trade-list">
                          {insiderTrades.slice(0, 6).map((trade, idx) => (
                            <div key={`${trade.date}-${idx}`} className="insider-trade-item">
                              <div className="trade-date">{trade.date}</div>
                              <div className="trade-type">{trade.type || 'N/A'}</div>
                              <div className="trade-volume">{trade.volume?.toLocaleString()}주</div>
                              {trade.insider_name && (
                                <div className="trade-insider">{trade.insider_name}</div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="insider-empty">최근 거래 내역 없음</p>
                  )}
                </div>
              </section>

              <section className="financials-chart-section">
                <h2 className="section-title">재무 실적</h2>
                {ticker ? (
                  <FinancialPerformanceChart ticker={ticker} />
                ) : (
                  <div className="chart-placeholder">
                    <p>📊 매출 및 순이익 차트 (데이터를 불러오는 중입니다)</p>
                  </div>
                )}
              </section>
            </div>
            </>
          </div>
        )}

        {activeTab === 'chart' && (
          <div key="chart-tab" className="tab-content-wrapper">
            <div className="chart-tab-content">
              <AdvancedChartWidget symbol={ticker} />
            </div>
          </div>
        )}

        {activeTab === 'financials' && ticker && (
          <div key="financials-tab" className="tab-content-wrapper">
            <FinancialStatementsView ticker={ticker} />
          </div>
        )}

        {activeTab === 'news' && (
          <div key="news-tab" className="tab-content-wrapper">
            <div className="tab-placeholder">
              <h2>📰 뉴스</h2>
              <p>최신 뉴스 목록 (추후 구현)</p>
            </div>
          </div>
        )}

        {activeTab === 'analysis' && (
          <div key="analysis-tab" className="tab-content-wrapper">
            <div className="tab-placeholder">
              <h2>📊 투자의견</h2>
              <p>상세 애널리스트 분석 (추후 구현)</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { companyApi } from '@/services/api/company'
import type { FinancialStatementsView as FinancialStatementsViewType } from '@/types'
import InsightCard from './InsightCard'
import FinancialChart from './FinancialChart'
import FinancialTable from './FinancialTable'
import Loading from '@/components/common/Loading'
import './Widgets.css'

interface Props {
  ticker: string
  initialSubTab?: string
}

export default function FinancialStatementsView({ ticker, initialSubTab = 'income' }: Props) {
  const [view, setView] = useState<FinancialStatementsViewType | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeSubTab, setActiveSubTab] = useState(initialSubTab)
  const [period, setPeriod] = useState<'annual' | 'quarter'>('annual')
  const [yearRange, setYearRange] = useState<1 | 2 | 3>(3)

  useEffect(() => {
    if (!ticker) return
    setLoading(true)
    companyApi
      .getFinancialStatementsView(ticker, activeSubTab, period, yearRange)
      .then((data) => setView(data))
      .catch(() => setView(null))
      .finally(() => setLoading(false))
  }, [ticker, activeSubTab, period, yearRange])

  if (loading) {
    return (
      <div className="financial-statements-loading">
        <Loading />
      </div>
    )
  }

  if (!view) {
    return <div className="financial-statements-empty">재무제표 데이터를 불러올 수 없습니다.</div>
  }

  return (
    <div className="financial-statements-view">
      <div className="financial-statements-header">
        <div className="financial-statements-tabs">
          {view.sub_tabs.map((tab) => (
            <button
              key={tab.id}
              className={`financial-statements-tab ${activeSubTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveSubTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="financial-statements-controls">
          <div className="financial-statements-period-selector">
            <button
              className={`period-btn ${period === 'annual' ? 'active' : ''}`}
              onClick={() => setPeriod('annual')}
            >
              연간
            </button>
            <button
              className={`period-btn ${period === 'quarter' ? 'active' : ''}`}
              onClick={() => setPeriod('quarter')}
            >
              분기
            </button>
          </div>
          {period === 'quarter' && (
            <div className="financial-statements-year-range-selector">
              <button
                className={`year-range-btn ${yearRange === 1 ? 'active' : ''}`}
                onClick={() => setYearRange(1)}
              >
                1년
              </button>
              <button
                className={`year-range-btn ${yearRange === 2 ? 'active' : ''}`}
                onClick={() => setYearRange(2)}
              >
                2년
              </button>
              <button
                className={`year-range-btn ${yearRange === 3 ? 'active' : ''}`}
                onClick={() => setYearRange(3)}
              >
                3년
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="financial-statements-widgets">
        {(() => {
          const insightCard = view.widgets.find((w) => w.type === 'insight_card')
          const chart = view.widgets.find((w) => w.type === 'financial_chart')
          const table = view.widgets.find((w) => w.type === 'financial_table')

          return (
            <>
              {/* 인사이트 카드와 차트를 나란히 배치 */}
              {(insightCard || chart) && (
                <div className={`financial-insight-chart-wrapper ${!insightCard ? 'chart-only' : ''}`}>
                  {insightCard && <InsightCard widget={insightCard} />}
                  {chart && <FinancialChart widget={chart} />}
                </div>
              )}
              {/* 테이블은 전체 너비로 배치 */}
              {table && <FinancialTable widget={table} />}
            </>
          )
        })()}
      </div>
    </div>
  )
}


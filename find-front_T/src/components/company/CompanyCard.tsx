import type { Company, StockQuote } from '@/types'
import { getCompanyLogoUrl, getCompanyDisplayName } from '@/utils/company'
import '@/pages/Dashboard/Dashboard.css'

interface CompanyCardProps {
  company: Company
  quote?: StockQuote | null
  onClick?: () => void
}

export default function CompanyCard({ company, quote, onClick }: CompanyCardProps) {
  const logoUrl = getCompanyLogoUrl(company)
  const displayName = getCompanyDisplayName(company)

  return (
    <div
      className="dashboard-card"
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      {/* 카드 헤더: 로고 + 기업명 + 티커 */}
      <div className="card-header">
        <div className="card-logo">
          <img 
            src={logoUrl}
            alt={company.companyName}
            onError={(e) => {
              e.currentTarget.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%236b7280"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/></svg>'
            }}
          />
        </div>
        <div className="card-company-info">
          <h3 className="card-company-name">{displayName}</h3>
          <p className="card-company-subtext">
            {company.k_name && <span className="card-company-en">{company.companyName}</span>}
            <span className="card-ticker">{company.ticker}</span>
          </p>
        </div>
      </div>

      {/* 카드 본문: 주가 정보 */}
      {quote ? (
        <div className="card-quote">
          <div className="card-price">${quote.price.toFixed(2)}</div>
          <div className={`card-change ${quote.change >= 0 ? 'positive' : 'negative'}`}>
            <span className="card-change-icon">{quote.change >= 0 ? '▲' : '▼'}</span>
            <span className="card-change-amount">${Math.abs(quote.change).toFixed(2)}</span>
            <span className="card-change-percent">
              ({quote.changePercent >= 0 ? '+' : ''}{quote.changePercent.toFixed(2)}%)
            </span>
          </div>
        </div>
      ) : (
        <div className="card-quote">
          <div className="card-price-placeholder">주가 정보 없음</div>
        </div>
      )}
    </div>
  )
}


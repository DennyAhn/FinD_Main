import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { searchApi } from '@/services/api/search'
import type { Company } from '@/types'
import './Search.css'

export default function Search() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Company[]>([])
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSearch = async () => {
    if (!query.trim()) return

    setLoading(true)
    try {
      const data = await searchApi.searchCompany(query)
      setResults(data)
    } catch (error) {
      console.error('Search error:', error)
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  const handleCompanyClick = (ticker: string) => {
    navigate(`/company/${ticker}`)
  }

  return (
    <div className="search">
      <div className="search-header">
        <h1>기업 검색</h1>
        <div className="search-input-container">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="기업명 또는 티커를 입력하세요 (예: 애플, AAPL)"
            className="search-input"
          />
          <button onClick={handleSearch} className="search-button" disabled={loading}>
            {loading ? '검색 중...' : '검색'}
          </button>
        </div>
      </div>

      {results.length > 0 && (
        <div className="search-results">
          <h2>검색 결과 ({results.length}개)</h2>
          <div className="results-list">
            {results.map((company) => (
              <div
                key={company.ticker}
                className="result-card"
                onClick={() => handleCompanyClick(company.ticker)}
              >
                <h3>{company.companyName}</h3>
                <p className="result-ticker">{company.ticker}</p>
                {company.industry && (
                  <p className="result-industry">{company.industry}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {results.length === 0 && query && !loading && (
        <div className="search-empty">
          <p>검색 결과가 없습니다.</p>
        </div>
      )}
    </div>
  )
}


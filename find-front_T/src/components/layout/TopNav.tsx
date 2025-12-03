import { useMarketStore, type MarketFilter } from '@/store/useMarketStore'
import { getMarketStatusMessage } from '@/utils/marketHours'
import { isUSMarketOpen } from '@/utils/marketHours'
import { useState, useEffect } from 'react'
import './TopNav.css'

export default function TopNav() {
  const { selectedMarket, setSelectedMarket } = useMarketStore()
  const [marketStatusMessage, setMarketStatusMessage] = useState('')
  const [isOpen, setIsOpen] = useState(false)

  // 마켓 상태 업데이트 (1분마다)
  useEffect(() => {
    const updateStatus = () => {
      setMarketStatusMessage(getMarketStatusMessage())
      setIsOpen(isUSMarketOpen().isOpen)
    }
    
    updateStatus()
    const interval = setInterval(updateStatus, 60000)
    
    return () => clearInterval(interval)
  }, [])

  const marketTabs: { id: MarketFilter; label: string }[] = [
    { id: 'NASDAQ', label: 'NASDAQ 100' },
    { id: 'DOW', label: '다우 30' },
    { id: 'SP500', label: 'S&P 500' },
    { id: 'ALL', label: '전체' },
  ]

  return (
    <nav className="top-nav">
      <div className="top-nav-logo">Fin:D</div>
      <div className="top-nav-content">
        {marketTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSelectedMarket(tab.id)}
            className={`top-nav-item ${selectedMarket === tab.id ? 'active' : ''}`}
          >
            {tab.label}
          </button>
        ))}
        <div className={`top-nav-market-status ${isOpen ? 'open' : 'closed'}`}>
          <span className="top-nav-status-dot"></span>
          <span className="top-nav-status-text">{marketStatusMessage}</span>
        </div>
      </div>
    </nav>
  )
}


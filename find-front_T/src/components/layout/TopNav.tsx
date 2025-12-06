import { useMarketStore, type MarketFilter } from '@/store/useMarketStore'
import { useChatStore } from '@/store/useChatStore'
import { getMarketStatusMessage } from '@/utils/marketHours'
import { isUSMarketOpen } from '@/utils/marketHours'
import { useState, useEffect } from 'react'
import './TopNav.css'

// 패널 닫기 아이콘 SVG 컴포넌트
const PanelCloseIcon = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <svg 
    className={className}
    style={style}
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 24 24"
    width="20"
    height="20"
  >
    <defs>
      <style>
        {`.panel-close-stroke {
          fill: none;
          stroke: currentColor;
          stroke-linecap: round;
          stroke-linejoin: round;
          stroke-width: 2px;
        }`}
      </style>
    </defs>
    <rect className="panel-close-stroke" x="3" y="3" width="18" height="18" rx="2" ry="2"/>
    <path className="panel-close-stroke" d="M9,3v18"/>
    <path className="panel-close-stroke" d="M14,9l3,3-3,3"/>
  </svg>
)

export default function TopNav() {
  const { selectedMarket, setSelectedMarket } = useMarketStore()
  const { isOpen: isChatOpen, toggleChat } = useChatStore()
  const [marketStatusMessage, setMarketStatusMessage] = useState('')
  const [isOpen, setIsOpen] = useState(false)

  // 마켓 상태 업데이트 (10초마다 - 더 자주 체크)
  useEffect(() => {
    const updateStatus = () => {
      const status = isUSMarketOpen()
      setMarketStatusMessage(getMarketStatusMessage())
      setIsOpen(status.isOpen)
      
      // 디버깅용 로그
      if (import.meta.env.DEV) {
        console.log('[TopNav 상태 업데이트]', {
          isOpen: status.isOpen,
          message: status.message,
          statusMessage: getMarketStatusMessage()
        })
      }
    }
    
    // 즉시 업데이트
    updateStatus()
    
    // 10초마다 업데이트
    const interval = setInterval(updateStatus, 10000)
    
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
      <button onClick={toggleChat} className="top-nav-chat-toggle">
        <PanelCloseIcon 
          style={{ 
            transform: isChatOpen ? 'rotate(0deg)' : 'rotate(180deg)',
            transition: 'transform 0.2s ease'
          }} 
        />
      </button>
    </nav>
  )
}


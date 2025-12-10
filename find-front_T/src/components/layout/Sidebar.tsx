import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/useAuthStore'
import { useState, useEffect } from 'react'
import FindLogo from '@/assets/icons/find logo2 1.svg'
import DashboardIcon from '@/assets/icons/dashboard-icon.svg'
import MarketIcon from '@/assets/icons/market-icon.svg'
import CompanyIcon from '@/assets/icons/company-icon.svg'
import AlertIcon from '@/assets/icons/alert-icon.svg'
import SettingsIcon from '@/assets/icons/settings-icon.svg'
import './Sidebar.css'

export default function Sidebar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { logout, user, fetchUser, isAuthenticated } = useAuthStore()
  const [showUserMenu, setShowUserMenu] = useState(false)

  // 사용자 정보 가져오기
  useEffect(() => {
    if (isAuthenticated && !user) {
      fetchUser()
    }
  }, [isAuthenticated, user, fetchUser])

  // 사용자 이름 및 아바타 초기 추출
  const userName = user?.name || user?.username || 'User'
  const userInitial = userName.charAt(0).toUpperCase()

  const menuSections = [
    {
      label: 'ANALYTICS',
      items: [
        { path: '/', label: '대시보드', icon: DashboardIcon, shortcut: '1' },
        { path: '/market', label: '시장분석', icon: MarketIcon, shortcut: '2' },
        { path: '/company', label: '기업분석', icon: CompanyIcon, shortcut: '3' },
      ]
    },
    {
      label: 'SYSTEM',
      items: [
        { path: '/alerts', label: '알림', icon: AlertIcon, shortcut: '4' },
        { path: '/settings', label: '설정', icon: SettingsIcon, shortcut: '5' },
      ]
    }
  ]

  // 키보드 단축키 기능
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // input, textarea 등에서는 단축키 비활성화
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      // 숫자 키 1-5 처리
      const allItems = menuSections.flatMap(section => section.items)
      const item = allItems.find(item => item.shortcut === e.key)

      if (item) {
        navigate(item.path)
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [navigate])

  const handleLogout = () => {
    logout()
    window.location.href = '/login'
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-brand">
          <img src={FindLogo} alt="Fin:D Logo" className="sidebar-logo-image" />
          <div className="sidebar-brand-text">
            <span className="sidebar-brand-name">Fin:D</span>
            <span className="sidebar-brand-tagline">Financial Intelligence</span>
          </div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {menuSections.map((section, sectionIndex) => (
          <div key={sectionIndex} className="sidebar-section">
            <div className="sidebar-section-label">{section.label}</div>
            {section.items.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`sidebar-item ${location.pathname === item.path ? 'active' : ''}`}
              >
                <div className="sidebar-item-content">
                  <img src={item.icon} alt={item.label} className="sidebar-icon" />
                  <span className="sidebar-label">{item.label}</span>
                </div>
                <span className="menu-shortcut">{item.shortcut}</span>
              </Link>
            ))}
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="user-profile-card" onClick={() => setShowUserMenu(!showUserMenu)}>
          <div className="user-avatar">{userInitial}</div>
          <div className="user-info">
            <div className="user-name">{userName}</div>
            <div className="user-plan">Free Plan</div>
          </div>
          <button className="user-menu-btn">⋮</button>
        </div>

        {showUserMenu && (
          <div className="user-dropdown-menu">
            <Link to="/settings" className="user-menu-item" onClick={() => setShowUserMenu(false)}>
              <span>⚙</span>
              <span>설정</span>
            </Link>
            <button className="user-menu-item logout" onClick={handleLogout}>
              <span>⎋</span>
              <span>로그아웃</span>
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}


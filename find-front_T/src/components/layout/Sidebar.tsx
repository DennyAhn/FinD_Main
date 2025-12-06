import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/useAuthStore'
import { useState, useEffect } from 'react'
import './Sidebar.css'

export default function Sidebar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { logout } = useAuthStore()
  const [showUserMenu, setShowUserMenu] = useState(false)

  const menuSections = [
    {
      label: 'ANALYTICS',
      items: [
        { path: '/', label: '대시보드', icon: '◧', shortcut: '1' },
        { path: '/market', label: '시장분석', icon: '⟫', shortcut: '2' },
        { path: '/company', label: '기업분석', icon: '◈', shortcut: '3' },
      ]
    },
    {
      label: 'SYSTEM',
      items: [
        { path: '/alerts', label: '알림', icon: '◉', shortcut: '4' },
        { path: '/settings', label: '설정', icon: '◐', shortcut: '5' },
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
        <h1 className="sidebar-logo">Fin:D</h1>
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
                  <span className="sidebar-icon">{item.icon}</span>
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
          <div className="user-avatar">U</div>
          <div className="user-info">
            <div className="user-name">User</div>
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


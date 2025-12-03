import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/useAuthStore'
import './Sidebar.css'

export default function Sidebar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { logout } = useAuthStore()

  const menuItems = [
    { path: '/', label: '대시보드', icon: '◧' },
    { path: '/market', label: '시장분석', icon: '⟫' },
    { path: '/company', label: '기업분석', icon: '◈' },
    { path: '/alerts', label: '알림', icon: '◉' },
    { path: '/settings', label: '설정', icon: '◐' },
  ]

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h1 className="sidebar-logo">Fin:D</h1>
      </div>
      <nav className="sidebar-nav">
        {menuItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`sidebar-item ${location.pathname === item.path ? 'active' : ''}`}
          >
            <span className="sidebar-icon">{item.icon}</span>
            <span className="sidebar-label">{item.label}</span>
          </Link>
        ))}
      </nav>
      <div className="sidebar-footer">
        <button onClick={handleLogout} className="sidebar-logout">
          <span className="sidebar-icon">⎋</span>
          <span className="sidebar-label">로그아웃</span>
        </button>
      </div>
    </aside>
  )
}


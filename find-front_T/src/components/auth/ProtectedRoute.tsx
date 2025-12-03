import { Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/useAuthStore'

interface ProtectedRouteProps {
  children: React.ReactNode
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated } = useAuthStore()

  // 🔓 임시: 로그인 체크 비활성화 (개발용)
  const DEV_MODE_BYPASS_AUTH = true

  if (!DEV_MODE_BYPASS_AUTH && !isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}


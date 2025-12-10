import { create } from 'zustand'

interface User {
  username: string
  name?: string
  email?: string
}

interface AuthState {
  isAuthenticated: boolean
  token: string | null
  user: User | null
  login: (token: string) => void
  logout: () => void
  checkAuth: () => void
  setUser: (user: User) => void
  fetchUser: () => Promise<void>
}

// sessionStorage에서 초기값 가져오기 (탭 닫으면 자동 삭제)
const getInitialAuth = () => {
  if (typeof window !== 'undefined') {
    const token = sessionStorage.getItem('access_token')
    return {
      isAuthenticated: !!token,
      token,
    }
  }
  return {
    isAuthenticated: false,
    token: null,
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  ...getInitialAuth(),
  user: null,
  login: (token: string) => {
    sessionStorage.setItem('access_token', token)
    set({ isAuthenticated: true, token })
    // 로그인 후 사용자 정보 가져오기
    get().fetchUser().catch(console.error)
  },
  logout: () => {
    sessionStorage.removeItem('access_token')
    set({ isAuthenticated: false, token: null, user: null })
  },
  checkAuth: () => {
    const token = sessionStorage.getItem('access_token')
    set({ isAuthenticated: !!token, token })
    // 인증 확인 후 사용자 정보 가져오기
    if (token) {
      get().fetchUser().catch(console.error)
    }
  },
  setUser: (user: User) => {
    set({ user })
  },
  fetchUser: async () => {
    try {
      const { authApi } = await import('@/services/api/auth')
      const userData = await authApi.getCurrentUser()
      set({ user: userData })
    } catch (error) {
      console.error('Failed to fetch user:', error)
      // 에러 발생 시 username만 사용 (토큰에서 추출하거나 기본값)
      const token = get().token
      if (token) {
        // JWT 토큰에서 username 추출 시도 (선택적)
        try {
          const payload = JSON.parse(atob(token.split('.')[1]))
          set({ user: { username: payload.sub || payload.username || 'User' } })
        } catch {
          set({ user: { username: 'User' } })
        }
      }
    }
  },
}))


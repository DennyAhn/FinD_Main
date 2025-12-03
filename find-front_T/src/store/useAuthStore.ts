import { create } from 'zustand'

interface AuthState {
  isAuthenticated: boolean
  token: string | null
  login: (token: string) => void
  logout: () => void
  checkAuth: () => void
}

// localStorage에서 초기값 가져오기
const getInitialAuth = () => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('access_token')
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

export const useAuthStore = create<AuthState>((set) => ({
  ...getInitialAuth(),
  login: (token: string) => {
    localStorage.setItem('access_token', token)
    set({ isAuthenticated: true, token })
  },
  logout: () => {
    localStorage.removeItem('access_token')
    set({ isAuthenticated: false, token: null })
  },
  checkAuth: () => {
    const token = localStorage.getItem('access_token')
    set({ isAuthenticated: !!token, token })
  },
}))


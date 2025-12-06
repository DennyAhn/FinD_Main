import apiClient from './client'

export interface LoginCredentials {
  username: string
  password: string
}

export interface RegisterData {
  username: string
  password: string
  name: string
  age: number
  email: string
}

export interface AuthResponse {
  access_token: string
  token_type: string
}

export const authApi = {
  // 로그인
  login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
    const formData = new URLSearchParams()
    formData.append('username', credentials.username)
    formData.append('password', credentials.password)

    try {
      const response = await apiClient.post('/auth/login', formData.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      })

      // localStorage 저장은 useAuthStore의 login() 함수에서 처리
      return response.data
    } catch (error: any) {
      console.error('Login API error:', error)
      throw error
    }
  },

  // 회원가입
  register: async (data: RegisterData): Promise<void> => {
    try {
      await apiClient.post('/auth/signup', data)
    } catch (error: any) {
      console.error('Register API error:', error)
      throw error
    }
  },

  // 로그아웃
  logout: (): void => {
    sessionStorage.removeItem('access_token')
  },

  // 현재 사용자 정보 조회
  getCurrentUser: async () => {
    const response = await apiClient.get('/auth/me')
    return response.data
  },
}


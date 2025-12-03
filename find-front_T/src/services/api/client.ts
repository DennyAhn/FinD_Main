import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
const API_VERSION = import.meta.env.VITE_API_VERSION || 'v1'

const apiClient = axios.create({
  baseURL: `${API_BASE_URL}/api/${API_VERSION}`,
  headers: {
    'Content-Type': 'application/json',
  },
})

// 요청 인터셉터: 토큰 추가
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// 응답 인터셉터: 에러 처리
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // 로그인 페이지에서는 리다이렉트하지 않음 (로그인 실패 시 폼이 초기화되는 것을 방지)
      const isLoginPage = window.location.pathname === '/login'
      
      if (!isLoginPage) {
        // 인증 실패 시 로그인 페이지로 리다이렉트 (로그인 페이지가 아닐 때만)
        localStorage.removeItem('access_token')
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default apiClient


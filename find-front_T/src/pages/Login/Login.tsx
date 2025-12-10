import { useState, useEffect } from 'react'
import { AxiosError } from 'axios'
import { authApi } from '@/services/api/auth'
import { useAuthStore } from '@/store/useAuthStore'
import FindLogo from '@/assets/icons/find logo2 1.svg'
import './Login.css'

interface ErrorResponse {
  detail?: string
}

export default function Login() {
  const { login, isAuthenticated } = useAuthStore()
  const [isLogin, setIsLogin] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // 초기 로딩 애니메이션
  const [isInitialLoading, setIsInitialLoading] = useState(true)
  
  // 로그인 프로세스 상태
  const [loginStatus, setLoginStatus] = useState<'idle' | 'logging' | 'success' | 'failed'>('idle')

  // 초기 로딩 애니메이션
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsInitialLoading(false)
    }, 4500) // 4.5초 후 카드 표시
    
    return () => clearTimeout(timer)
  }, [])

  // 이미 로그인된 사용자는 대시보드로 리다이렉트 (로그인 프로세스 중이 아닐 때만)
  useEffect(() => {
    if (isAuthenticated && loginStatus === 'idle') {
      console.log('✅ Already authenticated, redirecting to dashboard')
      window.location.href = '/'
    }
  }, [isAuthenticated, loginStatus])

  // 로그인 폼
  const [loginForm, setLoginForm] = useState({
    username: '',
    password: '',
  })

  // 회원가입 폼
  const [registerForm, setRegisterForm] = useState({
    username: '',
    password: '',
    name: '',
    age: 18,
    email: '',
  })

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    setLoginStatus('logging') // "Logging in..." 표시

    const startTime = Date.now() // 시작 시간 기록

    try {
      const response = await authApi.login({
        username: loginForm.username,
        password: loginForm.password,
      })

      console.log('✅ Login response:', response)

      // 응답 데이터 확인
      if (!response || !response.access_token) {
        throw new Error('토큰을 받지 못했습니다.')
      }

      // 토큰 저장 및 인증 상태 업데이트
      login(response.access_token)
      console.log('✅ Token saved, redirecting...')

      // [최소 3초 보장] API가 빨리 끝나도 3초는 "Logging in..." 표시
      const elapsed = Date.now() - startTime
      const minDuration = 3000 // 최소 3초
      const remaining = Math.max(0, minDuration - elapsed)

      await new Promise(resolve => setTimeout(resolve, remaining))

      // 성공 애니메이션 표시
      setLoginStatus('success')
      
      // React 렌더링 완료를 위한 짧은 지연 + 성공 화면 표시 (총 2초)
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // 성공 화면을 2초간 표시 후 리다이렉트
      await new Promise(resolve => setTimeout(resolve, 1900))
      
      window.location.href = '/'
    } catch (error) {
      const err = error as AxiosError<ErrorResponse>
      console.error('❌ Login error:', err)
      const errorMessage =
        err.response?.data?.detail ||
        err.message ||
        '로그인에 실패했습니다. 서버 연결을 확인해주세요.'
      
      // [최소 3초 보장] 실패 시에도 3초는 "Logging in..." 표시
      const elapsed = Date.now() - startTime
      const minDuration = 3000
      const remaining = Math.max(0, minDuration - elapsed)

      await new Promise(resolve => setTimeout(resolve, remaining))
      
      // 실패 애니메이션 표시
      setLoginStatus('failed')
      setError(errorMessage)
      
      // 2초 후 상태 초기화
      setTimeout(() => {
        setLoginStatus('idle')
        setLoading(false)
      }, 2000)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      await authApi.register(registerForm)
      // 회원가입 성공 시 로그인으로 전환
      setIsLogin(true)
      setLoginForm({
        username: registerForm.username,
        password: '',
      })
      setError(null)
      alert('회원가입이 완료되었습니다. 로그인해주세요.')
    } catch (error) {
      const err = error as AxiosError<ErrorResponse>
      console.error('Register error:', err)
      const errorMessage =
        err.response?.data?.detail ||
        err.message ||
        '회원가입에 실패했습니다. 서버 연결을 확인해주세요.'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-container">
      {/* 초기 로딩 애니메이션 (로고 3D 등장) */}
      {isInitialLoading && (
        <div className="initial-loading">
          <img src={FindLogo} alt="Fin:D" className="initial-logo" />
          <div className="initial-brand-text">
            <h1 className="initial-brand-name">Fin:D</h1>
            <p className="initial-tagline">Financial Intelligence</p>
          </div>
        </div>
      )}

      {/* 로그인 프로세스 오버레이 */}
      {loginStatus !== 'idle' && (
        <div className={`login-overlay ${loginStatus}`}>
          <div className="login-process">
            <img src={FindLogo} alt="Fin:D" className="process-logo" />
            {loginStatus === 'logging' && (
              <>
                <div className="process-spinner"></div>
                <p className="process-text">Logging in...</p>
              </>
            )}
            {loginStatus === 'success' && (
              <>
                <div className="process-checkmark">✓</div>
                <p className="process-text success">Login Successful!</p>
              </>
            )}
            {loginStatus === 'failed' && (
              <>
                <div className="process-cross">✕</div>
                <p className="process-text failed">Login Failed</p>
              </>
            )}
          </div>
        </div>
      )}

      <div className={`login-card ${!isInitialLoading ? 'fade-in' : ''}`}>
        <div className="login-header">
          <div className="login-brand">
            <img src={FindLogo} alt="Fin:D Logo" className="login-logo-image" />
            <div className="login-brand-text">
              <h1 className="login-logo">Fin:D</h1>
              <p className="login-tagline">Financial Intelligence</p>
            </div>
          </div>
          <p className="login-subtitle">Data to Insight, 가치를 찾다</p>
        </div>

        <div className="login-tabs">
          <button
            className={`login-tab ${isLogin ? 'active' : ''}`}
            onClick={() => {
              setIsLogin(true)
              setError(null)
            }}
          >
            로그인
          </button>
          <button
            className={`login-tab ${!isLogin ? 'active' : ''}`}
            onClick={() => {
              setIsLogin(false)
              setError(null)
            }}
          >
            회원가입
          </button>
        </div>

        {error && <div className="login-error">{error}</div>}

        {isLogin ? (
          <form key="login-form" onSubmit={handleLogin} className="login-form">
            <div className="form-group">
              <label htmlFor="username">ID</label>
              <input
                id="username"
                type="text"
                value={loginForm.username}
                onChange={(e) =>
                  setLoginForm({ ...loginForm, username: e.target.value })
                }
                required
                placeholder="ID를 입력하세요"
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={loginForm.password}
                onChange={(e) =>
                  setLoginForm({ ...loginForm, password: e.target.value })
                }
                required
                placeholder="Password를 입력하세요"
              />
            </div>

            <button type="submit" className="login-submit" disabled={loading}>
              {loading ? '로그인 중...' : '로그인'}
            </button>
          </form>
        ) : (
          <form key="register-form" onSubmit={handleRegister} className="login-form">
            <div className="form-group">
              <label htmlFor="reg-username">ID</label>
              <input
                id="reg-username"
                type="text"
                value={registerForm.username}
                onChange={(e) =>
                  setRegisterForm({ ...registerForm, username: e.target.value })
                }
                required
                placeholder="ID를 입력하세요"
              />
            </div>

            <div className="form-group">
              <label htmlFor="reg-password">Password</label>
              <input
                id="reg-password"
                type="password"
                value={registerForm.password}
                onChange={(e) =>
                  setRegisterForm({ ...registerForm, password: e.target.value })
                }
                required
                placeholder="Password를 입력하세요"
                minLength={6}
              />
            </div>

            <div className="form-group">
              <label htmlFor="reg-name">이름</label>
              <input
                id="reg-name"
                type="text"
                value={registerForm.name}
                onChange={(e) =>
                  setRegisterForm({ ...registerForm, name: e.target.value })
                }
                required
                placeholder="이름을 입력하세요"
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="reg-age">나이</label>
                <input
                  id="reg-age"
                  type="number"
                  value={registerForm.age}
                  onChange={(e) =>
                    setRegisterForm({
                      ...registerForm,
                      age: parseInt(e.target.value) || 18,
                    })
                  }
                  required
                  min={1}
                  max={150}
                />
              </div>

              <div className="form-group">
                <label htmlFor="reg-email">이메일</label>
                <input
                  id="reg-email"
                  type="email"
                  value={registerForm.email}
                  onChange={(e) =>
                    setRegisterForm({ ...registerForm, email: e.target.value })
                  }
                  required
                  placeholder="이메일을 입력하세요"
                />
              </div>
            </div>

            <button type="submit" className="login-submit" disabled={loading}>
              {loading ? '가입 중...' : '회원가입'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}


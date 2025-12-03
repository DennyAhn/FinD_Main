import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AxiosError } from 'axios'
import { authApi } from '@/services/api/auth'
import { useAuthStore } from '@/store/useAuthStore'
import './Login.css'

interface ErrorResponse {
  detail?: string
}

export default function Login() {
  const navigate = useNavigate()
  const { login } = useAuthStore()
  const [isLogin, setIsLogin] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

    try {
      const response = await authApi.login({
        username: loginForm.username,
        password: loginForm.password,
      })
      login(response.access_token)
      navigate('/')
    } catch (error) {
      const err = error as AxiosError<ErrorResponse>
      console.error('Login error:', err)
      const errorMessage = 
        err.response?.data?.detail || 
        err.message || 
        '로그인에 실패했습니다. 서버 연결을 확인해주세요.'
      setError(errorMessage)
    } finally {
      setLoading(false)
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
      <div className="login-card">
        <div className="login-header">
          <h1 className="login-logo">Fin:D</h1>
          <p className="login-subtitle">금융 데이터 분석 플랫폼</p>
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
          <form onSubmit={handleLogin} className="login-form">
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
          <form onSubmit={handleRegister} className="login-form">
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


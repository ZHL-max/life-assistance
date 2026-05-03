import { useEffect, useState } from 'react'
import { preloadBuaaLogin, loginBuaa, logoutBuaa } from '../storage/buaaConnector'
import { saveLocalSession, loadLocalSession, clearLocalSession } from '../storage/localSession'
import './AuthGate.css'

function createAppSession(buaaUser) {
  const schoolId = String(buaaUser.userId ?? '')
  return {
    buaaUser,
    user: {
      id: schoolId,
      email: `${schoolId}@buaa.local`,
      user_metadata: {
        name: buaaUser.userName,
        schoolId,
      },
    },
  }
}

export default function AuthGate({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [captcha, setCaptcha] = useState('')
  const [preLogin, setPreLogin] = useState(null)
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let mounted = true

    async function checkAuth() {
      // 优先检查本地存储的登录状态
      const local = loadLocalSession()
      if (local && local.user?.id) {
        if (mounted) {
          setSession(local)
          setLoading(false)
        }
        return
      }

      // 本地没有登录记录，加载登录页
      try {
        const preload = await preloadBuaaLogin()
        if (mounted) setPreLogin(preload)
      } catch {
        // ignore
      }
      if (mounted) setLoading(false)
    }

    checkAuth()

    return () => {
      mounted = false
    }
  }, [])

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (submitting) return

    setSubmitting(true)
    setMessage('')

    try {
      const result = await loginBuaa(username.trim(), password, {
        captcha,
        clientId: preLogin?.clientId,
        userId: username.trim(),
      })
      setPassword('')
      setCaptcha('')
      const newSession = createAppSession(result.user)
      saveLocalSession(newSession)
      setSession(newSession)
    } catch (error) {
      const msg = error.message || ''
      const isCredentialError = msg.includes('账号或密码') || msg.includes('验证码')
      setMessage(isCredentialError ? msg : `${msg || '网络繁忙'}，请检查网络后重试。`)
      // 短暂延迟再加载新的 preload，避免频繁请求北航 SSO
      await new Promise(r => setTimeout(r, 800))
      const preload = await preloadBuaaLogin().catch(() => null)
      if (preload) setPreLogin(preload)
    } finally {
      setSubmitting(false)
    }
  }

  const handleRefreshCaptcha = async () => {
    setCaptcha('')
    const preload = await preloadBuaaLogin()
    setPreLogin(preload)
  }

  const handleSignOut = async () => {
    const currentUserId = session?.user?.id
    await logoutBuaa(currentUserId).catch(() => {})
    clearLocalSession()
    setSession(null)
    setUsername('')
    setPassword('')
    try {
      const preload = await preloadBuaaLogin()
      setPreLogin(preload)
    } catch {
      // ignore
    }
  }

  if (loading) {
    return (
      <div className="auth-shell">
        <div className="auth-card compact">
          <img className="auth-mascot" src="/pika-icon.svg" alt="" aria-hidden="true" />
          <p>正在加载...</p>
        </div>
      </div>
    )
  }

  if (session) {
    return children({ session, onSignOut: handleSignOut })
  }

  return (
    <div className="auth-shell">
      <form className="auth-card" onSubmit={handleSubmit}>
        <img className="auth-mascot" src="/pika-icon.svg" alt="" aria-hidden="true" />
        <p className="auth-eyebrow">BUAA · Life Assistant</p>
        <h1>登录北航账号</h1>
        <p className="auth-copy">
          使用北航学号和统一认证密码登录。
        </p>

        <label className="auth-field">
          <span>北航学号</span>
          <input
            value={username}
            onChange={event => setUsername(event.target.value)}
            autoComplete="username"
            placeholder="例如 24375309"
            required
          />
        </label>

        <label className="auth-field">
          <span>北航密码</span>
          <input
            type="password"
            value={password}
            onChange={event => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
        </label>

        {preLogin?.captchaRequired && (
          <label className="auth-field">
            <span>验证码</span>
            <div className="captcha-row">
              <input
                value={captcha}
                onChange={event => setCaptcha(event.target.value)}
                autoComplete="off"
                required
              />
              {preLogin.captcha?.base64Image && (
                <button type="button" className="captcha-image-btn" onClick={handleRefreshCaptcha}>
                  <img src={preLogin.captcha.base64Image} alt="北航验证码" />
                </button>
              )}
            </div>
          </label>
        )}

        {message && <p className="auth-message">{message}</p>}

        <button className="auth-submit" type="submit" disabled={submitting}>
          {submitting ? '登录中...' : '登录'}
        </button>
      </form>
    </div>
  )
}

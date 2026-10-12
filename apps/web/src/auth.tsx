import { createContext, useContext, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { api, ApiError, type User } from './api'

interface Auth {
  /** `undefined` while the session is being checked, `null` when signed out. */
  user: User | null | undefined
  setUser: (user: User | null) => void
}

const AuthContext = createContext<Auth>({ user: undefined, setUser: () => {} })
export const useAuth = () => useContext(AuthContext)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null | undefined>(undefined)
  useEffect(() => {
    api<{ user: User | null }>('/auth/me').then(
      (res) => setUser(res.user),
      () => setUser(null),
    )
  }, [])
  return <AuthContext.Provider value={{ user, setUser }}>{children}</AuthContext.Provider>
}

/** Sends signed-out visitors to the sign-in page, and brings them back afterwards. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const location = useLocation()
  if (user === undefined) return <div className="center muted">Loading…</div>
  if (user === null) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <>{children}</>
}

export function Logo() {
  return (
    <div className="logo">
      <span className="logo-mark">F</span>
      Formknit
    </div>
  )
}

export function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const { user, setUser } = useAuth()
  const navigate = useNavigate()
  const from = (useLocation().state as { from?: string } | null)?.from ?? '/'
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)
  if (user) return <Navigate to={from} replace />
  const register = mode === 'register'

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const data = Object.fromEntries(new FormData(e.currentTarget))
    setBusy(true)
    setError(null)
    try {
      const res = await api<{ user: User }>(`/auth/${mode}`, { method: 'POST', body: data })
      setUser(res.user)
      navigate(from, { replace: true })
    } catch (err) {
      setError(err as ApiError)
    } finally {
      setBusy(false)
    }
  }
  const field = (name: string, label: string, type: string, autoComplete: string, hint?: string) => (
    <label className="field">
      <span>{label}</span>
      <input name={name} type={type} autoComplete={autoComplete} required aria-invalid={!!error?.fields[name]} />
      {error?.fields[name] ? <small className="danger">{error.fields[name][0]}</small> : hint && <small className="muted">{hint}</small>}
    </label>
  )
  return (
    <div className="center">
      <form className="card auth-card" onSubmit={submit}>
        <Logo />
        <div>
          <h1>{register ? 'Create your account' : 'Sign in'}</h1>
          <p className="muted">{register ? 'Start building forms in a few minutes.' : 'Welcome back. Enter your details to continue.'}</p>
        </div>
        {register && field('name', 'Full name', 'text', 'name')}
        {field('email', 'Email', 'email', 'email')}
        {field('password', 'Password', 'password', register ? 'new-password' : 'current-password', register ? 'At least 12 characters' : undefined)}
        {error && !Object.keys(error.fields).length && (
          <div className="banner danger" role="alert">
            {error.message}
          </div>
        )}
        <button className="button primary" disabled={busy}>
          {busy ? 'Please wait…' : register ? 'Create account' : 'Sign in'}
        </button>
        <p className="muted centered">
          {register ? 'Already have an account? ' : "Don't have an account? "}
          <Link to={register ? '/login' : '/register'}>{register ? 'Sign in' : 'Create one'}</Link>
        </p>
      </form>
    </div>
  )
}

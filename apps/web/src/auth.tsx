import { createContext, useCallback, useContext, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { api, ApiError, atLeast, ROLE_LABEL, type Role, type User, type Workspace } from './api'

interface Auth {
  /** `undefined` while the session is being checked, `null` when signed out. */
  user: User | null | undefined
  setUser: (user: User | null) => void
  /** The workspace being worked in, and the person's role there. */
  workspace: Workspace | undefined
  workspaces: Workspace[]
  /** Whether the person's role in this workspace is at least `minimum`. */
  can: (minimum: Role) => boolean
  /** Reloads the account and workspace, e.g. after switching workspace. */
  refresh: () => Promise<void>
}

const AuthContext = createContext<Auth>({ user: undefined, setUser: () => {}, workspace: undefined, workspaces: [], can: () => false, refresh: async () => {} })
export const useAuth = () => useContext(AuthContext)

interface Me {
  user: User | null
  workspace?: Workspace
  workspaces?: Workspace[]
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | undefined>(undefined)
  const refresh = useCallback(
    () =>
      api<Me>('/auth/me').then(
        (res) => setMe(res),
        () => setMe({ user: null }),
      ),
    [],
  )
  useEffect(() => void refresh(), [refresh])
  const value: Auth = {
    user: me === undefined ? undefined : me.user,
    // Signing in or out changes the workspace too, so reload everything.
    setUser: (user) => {
      setMe((current) => ({ ...current, user }))
      void refresh()
    },
    workspace: me?.workspace,
    workspaces: me?.workspaces ?? [],
    can: (minimum) => atLeast(me?.workspace?.role, minimum),
    refresh,
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
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
        {!register && (
          <p className="centered">
            <Link to="/forgot">Forgot your password?</Link>
          </p>
        )}
        <p className="muted centered">
          {register ? 'Already have an account? ' : "Don't have an account? "}
          <Link to={register ? '/login' : '/register'}>{register ? 'Sign in' : 'Create one'}</Link>
        </p>
      </form>
    </div>
  )
}

export function ForgotPage() {
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    try {
      await api('/auth/forgot', { method: 'POST', body: { email: new FormData(e.currentTarget).get('email') } })
      setSent(true)
    } catch (err) {
      setError(err as ApiError)
    }
  }
  return (
    <div className="center">
      <form className="card auth-card" onSubmit={submit}>
        <Logo />
        <div>
          <h1>Reset your password</h1>
          <p className="muted">Enter your email and we will send you a link to choose a new password.</p>
        </div>
        {sent ? (
          <div className="banner ok-bg" role="status">
            If an account exists for that address, a reset link is on its way. It works for one hour.
          </div>
        ) : (
          <>
            <label className="field">
              <span>Email</span>
              <input name="email" type="email" autoComplete="email" required />
            </label>
            {error && (
              <div className="banner danger" role="alert">
                {error.message}
              </div>
            )}
            <button className="button primary">Send reset link</button>
          </>
        )}
        <p className="centered">
          <Link to="/login">Back to sign in</Link>
        </p>
      </form>
    </div>
  )
}

export function ResetPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [error, setError] = useState<ApiError | null>(null)
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    try {
      await api('/auth/reset', { method: 'POST', body: { token: params.get('token'), password: new FormData(e.currentTarget).get('password') } })
      navigate('/login')
    } catch (err) {
      setError(err as ApiError)
    }
  }
  return (
    <div className="center">
      <form className="card auth-card" onSubmit={submit}>
        <Logo />
        <div>
          <h1>Choose a new password</h1>
          <p className="muted">You will be signed out everywhere and can then sign in with it.</p>
        </div>
        <label className="field">
          <span>New password</span>
          <input name="password" type="password" autoComplete="new-password" required aria-invalid={!!error?.fields.password} />
          {error?.fields.password ? <small className="danger">{error.fields.password[0]}</small> : <small className="muted">At least 12 characters</small>}
        </label>
        {error && !error.fields.password && (
          <div className="banner danger" role="alert">
            {error.message}
          </div>
        )}
        <button className="button primary">Change password</button>
        <p className="centered">
          <Link to="/forgot">Ask for a new link</Link>
        </p>
      </form>
    </div>
  )
}

/** Opened from the emailed link. Shows what the invitation is, then lets the invited person accept. */
export function InvitePage() {
  const { user, refresh } = useAuth()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const token = params.get('token') ?? ''
  const [invite, setInvite] = useState<{ workspace: string; email: string; role: Role } | null>(null)
  const [error, setError] = useState<ApiError | null>(null)
  useEffect(() => {
    api<{ workspace: string; email: string; role: Role }>(`/auth/invite?token=${encodeURIComponent(token)}`).then(setInvite, setError)
  }, [token])
  const accept = async () => {
    setError(null)
    try {
      await api('/invites/accept', { method: 'POST', body: { token } })
      await refresh()
      navigate('/')
    } catch (err) {
      setError(err as ApiError)
    }
  }
  const here = { from: `/invite?token=${token}` }
  return (
    <div className="center">
      <div className="card auth-card">
        <Logo />
        {!invite && !error && <p className="muted">Loading…</p>}
        {invite && (
          <>
            <div>
              <h1>Join {invite.workspace}</h1>
              <p className="muted">
                You have been invited as {ROLE_LABEL[invite.role].toLowerCase()}. The invitation was sent to <strong>{invite.email}</strong>.
              </p>
            </div>
            {user === null && (
              <>
                <p>Sign in or create an account with that email address to accept.</p>
                <Link className="button primary" to="/login" state={here}>
                  Sign in
                </Link>
                <Link className="button" to="/register" state={here}>
                  Create an account
                </Link>
              </>
            )}
            {user && (
              <button className="button primary" onClick={accept}>
                Accept invitation
              </button>
            )}
          </>
        )}
        {error && (
          <div className="banner danger" role="alert">
            {error.message}
          </div>
        )}
      </div>
    </div>
  )
}

import type { ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { api } from './api'
import { Logo, useAuth } from './auth'

/** The signed-in layout: navigation on the left, the page on the right. */
export function Shell({ children }: { children: ReactNode }) {
  const { user, setUser } = useAuth()
  const navigate = useNavigate()
  const signOut = async () => {
    await api('/auth/logout', { method: 'POST', body: {} }).catch(() => {})
    setUser(null)
    navigate('/login')
  }
  const initials = (user?.name ?? '?').split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()
  return (
    <div className="shell">
      <aside className="sidebar">
        <Logo />
        <nav>
          {/* Form and submission pages belong to Forms too, so it stays highlighted there. */}
          <NavLink to="/" className="nav active">
            Forms
          </NavLink>
        </nav>
        <div className="sidebar-user">
          <span className="avatar">{initials}</span>
          <div>
            <div className="strong">{user?.name}</div>
            <button className="link" onClick={signOut}>
              Sign out
            </button>
          </div>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  )
}

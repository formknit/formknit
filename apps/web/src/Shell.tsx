import type { ReactNode } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { api, ROLE_LABEL } from './api'
import { Logo, useAuth } from './auth'

/** The signed-in layout: navigation on the left, the page on the right. */
export function Shell({ children }: { children: ReactNode }) {
  const { user, setUser, workspace, workspaces, refresh } = useAuth()
  const navigate = useNavigate()
  const path = useLocation().pathname
  const signOut = async () => {
    await api('/auth/logout', { method: 'POST', body: {} }).catch(() => {})
    setUser(null)
    navigate('/login')
  }
  const switchTo = async (id: string) => {
    if (id === 'new') {
      const name = prompt('Name for the new workspace')?.trim()
      if (!name) return
      await api('/workspaces', { method: 'POST', body: { name } })
    } else {
      await api('/workspaces/switch', { method: 'POST', body: { id } })
    }
    await refresh()
    // Everything on screen belongs to the old workspace, so start again from the dashboard.
    navigate('/')
  }
  const initials = (user?.name ?? '?').split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()
  return (
    <div className="shell">
      <aside className="sidebar">
        <Logo />
        <label className="field workspace-switch">
          <span className="muted small">Workspace</span>
          <select value={workspace?.id ?? ''} onChange={(e) => void switchTo(e.target.value)}>
            {workspaces.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
            <option value="new">+ New workspace…</option>
          </select>
        </label>
        <nav>
          <NavLink to="/" end className={({ isActive }) => (isActive ? 'nav active' : 'nav')}>
            Dashboard
          </NavLink>
          {/* Submission pages belong to Forms too, so it stays highlighted there. */}
          <NavLink to="/forms" className={({ isActive }) => (isActive || path.startsWith('/submissions') ? 'nav active' : 'nav')}>
            Forms
          </NavLink>
          <NavLink to="/team" className={({ isActive }) => (isActive ? 'nav active' : 'nav')}>
            Team
          </NavLink>
          <NavLink to="/account" className={({ isActive }) => (isActive ? 'nav active' : 'nav')}>
            Account
          </NavLink>
        </nav>
        <div className="sidebar-user">
          <span className="avatar">{initials}</span>
          <div>
            <div className="strong">{user?.name}</div>
            {workspace && <div className="muted small">{ROLE_LABEL[workspace.role]}</div>}
            <button className="link" onClick={signOut}>
              Sign out
            </button>
          </div>
        </div>
      </aside>
      <main className="main" key={workspace?.id}>
        {children}
      </main>
    </div>
  )
}

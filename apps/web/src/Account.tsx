import { useState, type FormEvent } from 'react'
import { api, ApiError, useLoad, when, type User } from './api'
import { useAuth } from './auth'

interface Key {
  id: string
  name: string
  prefix: string
  createdAt: number
  lastUsedAt: number | null
}

export function AccountPage() {
  const { user, setUser } = useAuth()
  const keys = useLoad(() => api<{ keys: Key[] }>('/api-keys'), [])
  const [done, setDone] = useState('')
  const [error, setError] = useState<ApiError | null>(null)
  const [fresh, setFresh] = useState<string | null>(null)

  const run = async (what: string, work: () => Promise<void>) => {
    setDone('')
    setError(null)
    try {
      await work()
      setDone(what)
    } catch (err) {
      setError(err as ApiError)
    }
  }
  const saveProfile = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const name = new FormData(e.currentTarget).get('name')
    void run('profile', async () => setUser((await api<{ user: User }>('/auth/profile', { method: 'PATCH', body: { name } })).user))
  }
  const savePassword = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const data = Object.fromEntries(new FormData(form))
    void run('password', async () => {
      await api('/auth/password', { method: 'POST', body: data })
      form.reset()
    })
  }
  const createKey = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const name = new FormData(form).get('name')
    void run('key', async () => {
      setFresh((await api<{ key: string }>('/api-keys', { method: 'POST', body: { name } })).key)
      form.reset()
      keys.reload()
    })
  }
  const revoke = async (key: Key) => {
    if (!confirm(`Revoke "${key.name}"? Anything using it will stop working.`)) return
    await api(`/api-keys/${key.id}`, { method: 'DELETE' })
    keys.reload()
  }
  const fieldError = (name: string) => error?.fields[name] && <small className="danger">{error.fields[name][0]}</small>

  return (
    <>
      <header className="page-head">
        <h1>Account</h1>
      </header>
      <div className="settings">
        <form className="card stack" onSubmit={saveProfile}>
          <h2>Profile</h2>
          <label className="field">
            <span>Full name</span>
            <input name="name" defaultValue={user?.name} required />
            {fieldError('name')}
          </label>
          <label className="field">
            <span>Email</span>
            <input value={user?.email ?? ''} readOnly disabled />
          </label>
          <div className="row">
            <button className="button primary">Save profile</button>
            {done === 'profile' && <span className="ok small" role="status">Saved</span>}
          </div>
        </form>
        <form className="card stack" onSubmit={savePassword}>
          <h2>Password</h2>
          <label className="field">
            <span>Current password</span>
            <input name="currentPassword" type="password" autoComplete="current-password" required />
            {fieldError('currentPassword')}
          </label>
          <label className="field">
            <span>New password</span>
            <input name="newPassword" type="password" autoComplete="new-password" required />
            {fieldError('newPassword') ?? <small className="muted">At least 12 characters. Other devices are signed out.</small>}
          </label>
          <div className="row">
            <button className="button primary">Change password</button>
            {done === 'password' && <span className="ok small" role="status">Password changed</span>}
          </div>
        </form>
        <section className="card stack">
          <h2>API keys</h2>
          <p className="muted">
            A key lets your own programs read your forms and submissions. Send it as <code>Authorization: Bearer …</code>. Keys cannot change anything.
          </p>
          {fresh && (
            <div className="banner ok-bg" role="status">
              <strong>Copy this key now. It will not be shown again.</strong>
              <pre className="code">{fresh}</pre>
            </div>
          )}
          {(keys.data?.keys ?? []).map((key) => (
            <div className="row line" key={key.id}>
              <div className="grow">
                <div className="strong">{key.name}</div>
                <div className="muted small">
                  <code>{key.prefix}…</code> · created {when(key.createdAt)} · {key.lastUsedAt ? `last used ${when(key.lastUsedAt)}` : 'never used'}
                </div>
              </div>
              <button className="link danger" onClick={() => revoke(key)}>
                Revoke
              </button>
            </div>
          ))}
          <form className="row end" onSubmit={createKey}>
            <label className="field grow">
              <span>Name for a new key</span>
              <input name="name" required placeholder="e.g. Reporting script" />
            </label>
            <button className="button">Create key</button>
          </form>
        </section>
        {error && !Object.keys(error.fields).length && (
          <div className="banner danger" role="alert">
            {error.message}
          </div>
        )}
      </div>
    </>
  )
}

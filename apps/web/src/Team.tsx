import { useState, type FormEvent } from 'react'
import { api, ApiError, atLeast, ROLE_HELP, ROLE_LABEL, ROLES, useLoad, when, type Role } from './api'
import { useAuth } from './auth'

interface Member {
  id: string
  name: string
  email: string
  role: Role
  joinedAt: number
}
interface Invite {
  id: string
  email: string
  role: Role
  expiresAt: number
}

export function TeamPage() {
  const { user, workspace, can, refresh } = useAuth()
  const { data, error: loadError, loading, reload } = useLoad(() => api<{ members: Member[]; invites: Invite[] }>('/workspace/members'), [workspace?.id])
  const [error, setError] = useState<ApiError | null>(null)
  const [notice, setNotice] = useState('')
  if (!workspace) return null
  const mine = workspace.role
  // Roles this person may hand out: always below their own.
  const grantable = ROLES.filter((r) => r !== 'owner' && ROLES.indexOf(r) < ROLES.indexOf(mine))
  const manages = (member: Member) => can('admin') && member.id !== user?.id && ROLES.indexOf(member.role) < ROLES.indexOf(mine)

  const act = async (work: () => Promise<unknown>, done = '') => {
    setError(null)
    setNotice('')
    try {
      await work()
      setNotice(done)
      reload()
    } catch (err) {
      setError(err as ApiError)
    }
  }
  const invite = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const body = Object.fromEntries(new FormData(form))
    void act(async () => {
      await api('/workspace/invites', { method: 'POST', body })
      form.reset()
    }, `Invitation sent to ${body.email}`)
  }
  const rename = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const name = new FormData(e.currentTarget).get('name')
    void act(async () => {
      await api('/workspace', { method: 'PATCH', body: { name } })
      await refresh()
    }, 'Workspace renamed')
  }
  const remove = (member: Member) => {
    const self = member.id === user?.id
    if (!confirm(self ? `Leave ${workspace.name}? You will lose access to its forms.` : `Remove ${member.name} from ${workspace.name}?`)) return
    void act(async () => {
      await api(`/workspace/members/${member.id}`, { method: 'DELETE' })
      if (self) await refresh()
    })
  }

  return (
    <>
      <header className="page-head">
        <div>
          <p className="muted">{workspace.name}</p>
          <h1>Team</h1>
        </div>
      </header>
      {(error || loadError) && (
        <div className="banner danger" role="alert">
          {(error ?? loadError)?.fields.email?.[0] ?? (error ?? loadError)?.fields.role?.[0] ?? (error ?? loadError)?.message}
        </div>
      )}
      {notice && (
        <div className="banner ok-bg" role="status">
          {notice}
        </div>
      )}
      {loading && !data ? (
        <p className="muted">Loading…</p>
      ) : (
        <table className="table card">
          <thead>
            <tr>
              <th>Member</th>
              <th>Role</th>
              <th>Joined</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(data?.members ?? []).map((member) => (
              <tr key={member.id}>
                <td>
                  <div className="strong">
                    {member.name} {member.id === user?.id && <span className="muted">(you)</span>}
                  </div>
                  <div className="muted small">{member.email}</div>
                </td>
                <td>
                  {manages(member) ? (
                    <select
                      aria-label={`Role for ${member.name}`}
                      value={member.role}
                      onChange={(e) => void act(() => api(`/workspace/members/${member.id}`, { method: 'PATCH', body: { role: e.target.value } }))}
                    >
                      {grantable.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABEL[r]}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="badge">{ROLE_LABEL[member.role]}</span>
                  )}
                </td>
                <td>{when(member.joinedAt)}</td>
                <td className="actions">
                  {manages(member) && (
                    <button className="link danger" onClick={() => remove(member)}>
                      Remove
                    </button>
                  )}
                  {member.id === user?.id && member.role !== 'owner' && (
                    <button className="link danger" onClick={() => remove(member)}>
                      Leave
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="settings">
        {can('admin') && (
          <section className="card stack">
            <h2>Invite someone</h2>
            <form className="row end" onSubmit={invite}>
              <label className="field grow">
                <span>Email</span>
                <input name="email" type="email" required placeholder="name@example.com" />
              </label>
              <label className="field">
                <span>Role</span>
                <select name="role" defaultValue="editor">
                  {grantable.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </option>
                  ))}
                </select>
              </label>
              <button className="button primary">Send invitation</button>
            </form>
            {(data?.invites ?? []).map((i) => (
              <div className="row line" key={i.id}>
                <div className="grow">
                  <div className="strong">{i.email}</div>
                  <div className="muted small">
                    Invited as {ROLE_LABEL[i.role].toLowerCase()} · expires {when(i.expiresAt)}
                  </div>
                </div>
                <button className="link danger" onClick={() => void act(() => api(`/workspace/invites/${i.id}`, { method: 'DELETE' }))}>
                  Withdraw
                </button>
              </div>
            ))}
          </section>
        )}
        <section className="card stack">
          <h2>What each role can do</h2>
          <dl className="roles">
            {ROLES.map((r) => (
              <div key={r}>
                <dt>{ROLE_LABEL[r]}</dt>
                <dd className="muted">{ROLE_HELP[r]}</dd>
              </div>
            ))}
          </dl>
        </section>
        {atLeast(mine, 'owner') && (
          <form className="card stack" onSubmit={rename}>
            <h2>Workspace name</h2>
            <div className="row end">
              <label className="field grow">
                <span>Name</span>
                <input name="name" defaultValue={workspace.name} required />
              </label>
              <button className="button">Rename</button>
            </div>
          </form>
        )}
      </div>
    </>
  )
}

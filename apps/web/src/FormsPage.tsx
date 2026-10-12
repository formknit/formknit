import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, ApiError, CLOSED_TEXT, useLoad, when, type FormDetail, type FormSummary } from './api'
import { useAuth } from './auth'

export function StatusBadge({ form }: { form: Pick<FormSummary, 'status' | 'unpublishedChanges' | 'closedReason'> }) {
  if (form.status === 'draft') return <span className="badge">Draft</span>
  return (
    <>
      {form.unpublishedChanges ? <span className="badge warn">Unpublished changes</span> : <span className="badge ok">Published</span>}
      {form.closedReason && <span className="badge bad">{CLOSED_TEXT[form.closedReason]}</span>}
    </>
  )
}

export function FormsPage() {
  const navigate = useNavigate()
  const { can } = useAuth()
  const { data, error, loading, reload } = useLoad(() => api<{ forms: FormSummary[] }>('/forms'), [])
  const templates = useLoad(() => api<{ templates: { id: string; name: string; description: string; fields: number }[] }>('/templates'), [])
  const [creating, setCreating] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  const create = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    const name = String(data.get('name') ?? '').trim()
    const template = String(data.get('template') ?? '') || undefined
    try {
      const res = await api<{ form: FormDetail }>('/forms', { method: 'POST', body: { name, template } })
      navigate(`/forms/${res.form.id}`)
    } catch (err) {
      setProblem((err as ApiError).message)
    }
  }
  const remove = async (form: FormSummary) => {
    const warning = form.submissions ? ` and its ${form.submissions} ${form.submissions === 1 ? 'submission' : 'submissions'}` : ''
    if (!confirm(`Delete "${form.name}"${warning}? This cannot be undone.`)) return
    try {
      await api(`/forms/${form.id}`, { method: 'DELETE' })
      reload()
    } catch (err) {
      setProblem((err as ApiError).message)
    }
  }
  const duplicate = async (form: FormSummary) => {
    try {
      const res = await api<{ form: FormDetail }>(`/forms/${form.id}/duplicate`, { method: 'POST', body: {} })
      navigate(`/forms/${res.form.id}`)
    } catch (err) {
      setProblem((err as ApiError).message)
    }
  }
  const forms = data?.forms ?? []
  const total = forms.reduce((n, f) => n + f.submissions, 0)

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Forms</h1>
          <p className="muted">
            {forms.length} {forms.length === 1 ? 'form' : 'forms'} · {total} {total === 1 ? 'submission' : 'submissions'}
          </p>
        </div>
        {!creating && can('editor') && (
          <button className="button primary" onClick={() => setCreating(true)}>
            + New form
          </button>
        )}
      </header>
      {creating && (
        <form className="card row end" onSubmit={create}>
          <label className="field grow">
            <span>Form name</span>
            <input name="name" autoFocus required placeholder="e.g. Admission form" />
          </label>
          <label className="field">
            <span>Start from</span>
            <select name="template" defaultValue="">
              <option value="">A blank form</option>
              {(templates.data?.templates ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.fields} fields)
                </option>
              ))}
            </select>
          </label>
          <button className="button primary">Create form</button>
          <button type="button" className="button" onClick={() => setCreating(false)}>
            Cancel
          </button>
        </form>
      )}
      {(problem || error) && (
        <div className="banner danger" role="alert">
          {problem ?? error?.message}
        </div>
      )}
      {loading && !data ? (
        <p className="muted">Loading…</p>
      ) : forms.length === 0 ? (
        <div className="card empty">
          <h2>No forms yet</h2>
          <p className="muted">{can('editor') ? 'Create your first form, design it by dragging fields, then share the link.' : 'This workspace has no forms yet.'}</p>
        </div>
      ) : (
        <table className="table card">
          <thead>
            <tr>
              <th>Name</th>
              <th>Status</th>
              <th>Submissions</th>
              <th>Last updated</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {forms.map((form) => (
              <tr key={form.id}>
                <td>
                  <Link className="strong" to={`/forms/${form.id}`}>
                    {form.name}
                  </Link>
                  <div className="muted small">/f/{form.slug}</div>
                </td>
                <td>
                  <StatusBadge form={form} />
                </td>
                <td>{form.submissions}</td>
                <td>{when(form.updatedAt)}</td>
                <td className="actions">
                  <Link to={`/forms/${form.id}`}>{can('editor') ? 'Edit' : 'Open'}</Link>
                  {can('editor') && (
                    <button className="link" onClick={() => duplicate(form)}>
                      Duplicate
                    </button>
                  )}
                  {can('admin') && (
                    <button className="link danger" onClick={() => remove(form)}>
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}

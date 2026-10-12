import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, ApiError, useLoad, when, type FormDetail, type FormSummary } from './api'

export function StatusBadge({ form }: { form: Pick<FormSummary, 'status' | 'unpublishedChanges'> }) {
  if (form.status === 'draft') return <span className="badge">Draft</span>
  if (form.unpublishedChanges) return <span className="badge warn">Unpublished changes</span>
  return <span className="badge ok">Published</span>
}

export function FormsPage() {
  const navigate = useNavigate()
  const { data, error, loading, reload } = useLoad(() => api<{ forms: FormSummary[] }>('/forms'), [])
  const [creating, setCreating] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  const create = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const name = String(new FormData(e.currentTarget).get('name') ?? '').trim()
    try {
      const res = await api<{ form: FormDetail }>('/forms', { method: 'POST', body: { name } })
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
        {!creating && (
          <button className="button primary" onClick={() => setCreating(true)}>
            + New form
          </button>
        )}
      </header>
      {creating && (
        <form className="card row" onSubmit={create}>
          <label className="field grow">
            <span>Form name</span>
            <input name="name" autoFocus required placeholder="e.g. Admission form" />
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
          <p className="muted">Create your first form, design it by dragging fields, then share the link.</p>
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
                  <Link to={`/forms/${form.id}`}>Edit</Link>
                  <button className="link danger" onClick={() => remove(form)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}

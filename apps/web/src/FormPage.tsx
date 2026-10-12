import { FormBuilder } from '@formknit/builder'
import type { FormSchema } from '@formknit/core'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { api, ApiError, show, useLoad, when, type Column, type FormDetail, type FormSummary, type Submission } from './api'
import { StatusBadge } from './FormsPage'

type Tab = 'build' | 'submissions' | 'settings' | 'share'
const TABS: { id: Tab; label: string }[] = [
  { id: 'build', label: 'Build' },
  { id: 'submissions', label: 'Submissions' },
  { id: 'settings', label: 'Settings' },
  { id: 'share', label: 'Share' },
]

export function FormPage() {
  const { id = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const tab = (TABS.find((t) => t.id === params.get('tab'))?.id ?? 'build') as Tab
  const { data, error, loading, setData } = useLoad(() => api<{ form: FormDetail }>(`/forms/${id}`), [id])
  const [saving, setSaving] = useState<'saved' | 'saving' | 'failed'>('saved')
  const [problem, setProblem] = useState<ApiError | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const pending = useRef<FormSchema | null>(null)
  const form = data?.form

  const flush = async () => {
    const schema = pending.current
    if (!schema) return
    pending.current = null
    try {
      const res = await api<{ form: FormDetail }>(`/forms/${id}`, { method: 'PATCH', body: { schema } })
      // Keep what is on screen if more edits arrived while this was saving.
      if (!pending.current) {
        setData({ form: res.form })
        setSaving('saved')
      }
    } catch {
      setSaving('failed')
    }
  }
  // Save shortly after the last edit, and straight away when leaving the page.
  const onSchema = (schema: FormSchema) => {
    if (form) setData({ form: { ...form, schema } })
    pending.current = schema
    setSaving('saving')
    clearTimeout(timer.current)
    timer.current = setTimeout(flush, 700)
  }
  useEffect(
    () => () => {
      clearTimeout(timer.current)
      void flush()
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id],
  )

  const publish = async (action: 'publish' | 'unpublish') => {
    setProblem(null)
    clearTimeout(timer.current)
    await flush()
    try {
      const res = await api<{ form: FormSummary }>(`/forms/${id}/${action}`, { method: 'POST', body: {} })
      if (form) setData({ form: { ...form, ...res.form } })
    } catch (err) {
      setProblem(err as ApiError)
    }
  }

  if (error) return <div className="banner danger">{error.status === 404 ? 'This form does not exist.' : error.message}</div>
  if (loading && !form) return <p className="muted">Loading…</p>
  if (!form) return null
  const needsPublish = form.status === 'draft' || form.unpublishedChanges

  return (
    <div className="form-page">
      <header className="page-head">
        <div>
          <p className="muted small">
            <Link to="/">Forms</Link> /
          </p>
          <h1>
            {form.name} <StatusBadge form={form} />
          </h1>
        </div>
        <div className="row">
          <span className={saving === 'failed' ? 'danger small' : 'muted small'} aria-live="polite">
            {saving === 'saving' ? 'Saving…' : saving === 'failed' ? 'Could not save. Check your connection.' : 'All changes saved'}
          </span>
          {form.status === 'published' && (
            <a className="button" href={`/f/${form.slug}`} target="_blank" rel="noreferrer">
              View form
            </a>
          )}
          <button className="button primary" disabled={!needsPublish} onClick={() => publish('publish')}>
            {form.status === 'draft' ? 'Publish' : needsPublish ? 'Publish changes' : 'Published'}
          </button>
        </div>
      </header>
      {problem && (
        <div className="banner danger" role="alert">
          <strong>{problem.message}</strong>
          <ul>
            {Object.entries(problem.fields).map(([key, messages]) => (
              <li key={key}>
                {key.replace(/^\d+:/, '')}: {messages.join(', ')}
              </li>
            ))}
          </ul>
        </div>
      )}
      <nav className="tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'tab active' : 'tab'} onClick={() => setParams(t.id === 'build' ? {} : { tab: t.id })}>
            {t.label}
            {t.id === 'submissions' && form.submissions > 0 && <span className="count">{form.submissions}</span>}
          </button>
        ))}
      </nav>
      {tab === 'build' && (
        <div className="builder-area">
          <FormBuilder defaultValue={form.schema} onChange={onSchema} />
        </div>
      )}
      {tab === 'submissions' && <Submissions form={form} />}
      {tab === 'settings' && <Settings form={form} onSaved={(next) => setData({ form: next })} onUnpublish={() => publish('unpublish')} />}
      {tab === 'share' && <Share form={form} />}
    </div>
  )
}

function Submissions({ form }: { form: FormDetail }) {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const size = 25
  const { data, error, loading } = useLoad(
    () => api<{ submissions: Submission[]; total: number; columns: Column[] }>(`/forms/${form.id}/submissions?limit=${size}&offset=${page * size}&q=${encodeURIComponent(search)}`),
    [form.id, page, search],
  )
  if (error) return <div className="banner danger">{error.message}</div>
  const columns = (data?.columns ?? []).slice(0, 5)
  const total = data?.total ?? 0
  return (
    <>
      <div className="row">
        <form
          className="row grow"
          onSubmit={(e) => {
            e.preventDefault()
            setPage(0)
            setSearch(q)
          }}
        >
          <input className="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search submissions" aria-label="Search submissions" />
          <button className="button">Search</button>
        </form>
        <span className="muted small">
          {total} {total === 1 ? 'result' : 'results'}
        </span>
        <a className="button" href={`/api/forms/${form.id}/submissions.csv`}>
          Export CSV
        </a>
      </div>
      {loading && !data ? (
        <p className="muted">Loading…</p>
      ) : total === 0 ? (
        <div className="card empty">
          <h2>{search ? 'Nothing matches that search' : 'No submissions yet'}</h2>
          <p className="muted">{search ? 'Try different words.' : form.status === 'published' ? 'Share the form link to start collecting responses.' : 'Publish the form, then share its link.'}</p>
        </div>
      ) : (
        <table className="table card">
          <thead>
            <tr>
              <th>Submitted</th>
              {columns.map((c) => (
                <th key={c.key}>{c.label}</th>
              ))}
              <th />
            </tr>
          </thead>
          <tbody>
            {data!.submissions.map((s) => (
              <tr key={s.id} className="clickable" onClick={() => navigate(`/submissions/${s.id}`)}>
                <td>{when(s.createdAt)}</td>
                {columns.map((c) => (
                  <td key={c.key}>{show(s.data[c.key])}</td>
                ))}
                <td className="actions">
                  <Link to={`/submissions/${s.id}`} onClick={(e) => e.stopPropagation()}>
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {total > size && (
        <div className="row">
          <span className="muted small grow">
            Showing {page * size + 1}–{Math.min(total, (page + 1) * size)} of {total}
          </span>
          <button className="button" disabled={page === 0} onClick={() => setPage(page - 1)}>
            Previous
          </button>
          <button className="button" disabled={(page + 1) * size >= total} onClick={() => setPage(page + 1)}>
            Next
          </button>
        </div>
      )}
    </>
  )
}

function Settings({ form, onSaved, onUnpublish }: { form: FormDetail; onSaved: (form: FormDetail) => void; onUnpublish: () => void }) {
  const navigate = useNavigate()
  const [error, setError] = useState<ApiError | null>(null)
  const [saved, setSaved] = useState(false)
  const [exposed, setExposed] = useState(() => new Set(form.settings.exposedFields ?? []))
  const { data } = useLoad(() => api<{ columns: Column[] }>(`/forms/${form.id}/submissions?limit=1`), [form.id])

  const save = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    setError(null)
    setSaved(false)
    try {
      const res = await api<{ form: FormDetail }>(`/forms/${form.id}`, {
        method: 'PATCH',
        body: {
          name: f.get('name'),
          slug: f.get('slug'),
          settings: { successMessage: f.get('successMessage'), maxSubmissions: f.get('maxSubmissions'), closed: f.get('closed') === 'on', exposedFields: [...exposed] },
        },
      })
      onSaved(res.form)
      setSaved(true)
    } catch (err) {
      setError(err as ApiError)
    }
  }
  const remove = async () => {
    if (!confirm(`Delete "${form.name}" and all of its submissions? This cannot be undone.`)) return
    await api(`/forms/${form.id}`, { method: 'DELETE' })
    navigate('/')
  }
  const fieldError = (name: string) => error?.fields[name] && <small className="danger">{error.fields[name][0]}</small>

  return (
    <form className="settings" onSubmit={save}>
      <section className="card stack">
        <h2>General</h2>
        <label className="field">
          <span>Form name</span>
          <input name="name" defaultValue={form.name} required />
          {fieldError('name')}
        </label>
        <label className="field">
          <span>Address</span>
          <div className="row tight">
            <span className="muted">{location.origin}/f/</span>
            <input name="slug" defaultValue={form.slug} required className="grow" />
          </div>
          {fieldError('slug') ?? <small className="muted">Changing this breaks links you have already shared.</small>}
        </label>
        <label className="field">
          <span>Message after submitting</span>
          <input name="successMessage" defaultValue={form.settings.successMessage ?? ''} placeholder="Thank you. Your response has been recorded." />
        </label>
      </section>
      <section className="card stack">
        <h2>Limits</h2>
        <label className="field">
          <span>Maximum submissions</span>
          <input name="maxSubmissions" type="number" min="1" defaultValue={form.settings.maxSubmissions ?? ''} placeholder="No limit" />
        </label>
        <label className="check">
          <input name="closed" type="checkbox" defaultChecked={!!form.settings.closed} />
          <span>Stop accepting responses</span>
        </label>
      </section>
      <section className="card stack">
        <h2>Data access</h2>
        <p className="muted">
          Tick the fields that lookup fields in your other forms may read from this form's submissions. Fields left unticked are never shared. Other forms refer to this one as{' '}
          <code>{form.slug}</code>.
        </p>
        {(data?.columns ?? []).length === 0 && <p className="muted">This form has no fields yet.</p>}
        {(data?.columns ?? []).map((c) => (
          <label className="check" key={c.key}>
            <input
              type="checkbox"
              checked={exposed.has(c.key)}
              onChange={(e) => {
                const next = new Set(exposed)
                if (e.target.checked) next.add(c.key)
                else next.delete(c.key)
                setExposed(next)
              }}
            />
            <span>
              {c.label} <code>{c.key}</code>
            </span>
          </label>
        ))}
      </section>
      <div className="row">
        <button className="button primary">Save settings</button>
        {saved && <span className="ok small" role="status">Saved</span>}
        {error && !Object.keys(error.fields).length && <span className="danger small">{error.message}</span>}
      </div>
      <section className="card stack">
        <h2>Danger zone</h2>
        <div className="row">
          {form.status === 'published' && (
            <button type="button" className="button" onClick={onUnpublish}>
              Unpublish
            </button>
          )}
          <button type="button" className="button danger" onClick={remove}>
            Delete form
          </button>
        </div>
      </section>
    </form>
  )
}

function Share({ form }: { form: FormDetail }) {
  const url = `${location.origin}/f/${form.slug}`
  const embed = `<iframe src="${url}" title="${form.name.replace(/"/g, '&quot;')}" style="width:100%;height:700px;border:0"></iframe>`
  const [copied, setCopied] = useState('')
  const copy = async (what: string, text: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(what)
  }
  if (form.status !== 'published') {
    return (
      <div className="card empty">
        <h2>Publish the form to share it</h2>
        <p className="muted">People can only open a form once it is published.</p>
      </div>
    )
  }
  return (
    <div className="settings">
      <section className="card stack">
        <h2>Public link</h2>
        <div className="row">
          <input className="grow" readOnly value={url} aria-label="Public link" onFocus={(e) => e.target.select()} />
          <button className="button" onClick={() => copy('link', url)}>
            {copied === 'link' ? 'Copied' : 'Copy'}
          </button>
          <a className="button" href={url} target="_blank" rel="noreferrer">
            Open
          </a>
        </div>
      </section>
      <section className="card stack">
        <h2>Embed on a website</h2>
        <pre className="code">{embed}</pre>
        <div>
          <button className="button" onClick={() => copy('embed', embed)}>
            {copied === 'embed' ? 'Copied' : 'Copy code'}
          </button>
        </div>
      </section>
    </div>
  )
}

export function SubmissionPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { data, error, loading } = useLoad(() => api<{ submission: Submission; form: { id: string; name: string }; columns: Column[] }>(`/submissions/${id}`), [id])
  if (error) return <div className="banner danger">{error.status === 404 ? 'This submission does not exist.' : error.message}</div>
  if (loading || !data) return <p className="muted">Loading…</p>
  const { submission, form, columns } = data
  const back = `/forms/${form.id}?tab=submissions`
  const remove = async () => {
    if (!confirm('Delete this submission? This cannot be undone.')) return
    await api(`/submissions/${id}`, { method: 'DELETE' })
    navigate(back)
  }
  const known = new Set(columns.map((c) => c.key))
  // Answers to fields that have since been removed from the form are still shown.
  const rows = [...columns, ...Object.keys(submission.data).filter((k) => !known.has(k)).map((key) => ({ key, label: key }))]
  return (
    <>
      <header className="page-head">
        <div>
          <p className="muted small">
            <Link to="/">Forms</Link> / <Link to={`/forms/${form.id}`}>{form.name}</Link> / <Link to={back}>Submissions</Link>
          </p>
          <h1>Submission</h1>
          <p className="muted">
            {when(submission.createdAt)} · <code>{submission.id}</code>
          </p>
        </div>
        <div className="row">
          <button className="button" onClick={() => window.print()}>
            Print
          </button>
          <button className="button danger" onClick={remove}>
            Delete
          </button>
        </div>
      </header>
      <dl className="card answers">
        {rows.map((c) => {
          const value = submission.data[c.key]
          const nested = Array.isArray(value) && value.length > 0 && typeof value[0] === 'object'
          return (
            <div key={c.key}>
              <dt>{c.label}</dt>
              <dd>
                {typeof value === 'string' && value.startsWith('data:image/') ? (
                  <img className="signature" src={value} alt={`${c.label} (signature)`} />
                ) : nested ? (
                  <pre className="code">{JSON.stringify(value, null, 2)}</pre>
                ) : (
                  show(value)
                )}
              </dd>
            </div>
          )
        })}
      </dl>
    </>
  )
}

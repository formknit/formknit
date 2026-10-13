import { FormBuilder } from '@formknit/builder'
import { htmlToText, type FormSchema } from '@formknit/core'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Form } from '@formknit/react'
import { RichTextView } from '@formknit/richtext'
import {
  api,
  components,
  ApiError,
  show,
  STATUS_CLASS,
  STATUS_LABEL,
  STATUSES,
  useLoad,
  when,
  type Column,
  type FormDetail,
  type FormSummary,
  type Status,
  type Submission,
} from './api'
import { useAuth } from './auth'
import { Reports, Versions, Webhooks } from './FormExtras'
import { StatusBadge } from './FormsPage'

type Tab = 'build' | 'submissions' | 'reports' | 'settings' | 'share' | 'versions'
const TABS: { id: Tab; label: string }[] = [
  { id: 'build', label: 'Build' },
  { id: 'submissions', label: 'Submissions' },
  { id: 'reports', label: 'Reports' },
  { id: 'settings', label: 'Settings' },
  { id: 'share', label: 'Share' },
  { id: 'versions', label: 'Versions' },
]

export function FormPage() {
  const { id = '' } = useParams()
  const { can } = useAuth()
  const [params, setParams] = useSearchParams()
  // People who cannot edit start on the submissions, and do not see the tabs that change the form.
  const tabs = TABS.filter((t) => can('editor') || t.id === 'submissions' || t.id === 'reports' || t.id === 'share')
  const tab = (tabs.find((t) => t.id === params.get('tab'))?.id ?? tabs[0].id) as Tab
  const { data, error, loading, setData } = useLoad(
    () => api<{ form: FormDetail }>(`/forms/${id}`),
    [id],
  )
  const [saving, setSaving] = useState<'saved' | 'saving' | 'failed'>('saved')
  const [problem, setProblem] = useState<ApiError | null>(null)
  // Bumped when the draft is replaced from outside the builder, so the builder starts again from it.
  const [draftEpoch, setDraftEpoch] = useState(0)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const pending = useRef<FormSchema | null>(null)
  const form = data?.form

  const flush = async () => {
    const schema = pending.current
    if (!schema) return
    pending.current = null
    try {
      const res = await api<{ form: FormDetail }>(`/forms/${id}`, {
        method: 'PATCH',
        body: { schema },
      })
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
      const res = await api<{ form: FormSummary }>(`/forms/${id}/${action}`, {
        method: 'POST',
        body: {},
      })
      if (form) setData({ form: { ...form, ...res.form } })
    } catch (err) {
      setProblem(err as ApiError)
    }
  }

  if (error)
    return (
      <div className="banner danger">
        {error.status === 404 ? 'This form does not exist.' : error.message}
      </div>
    )
  if (loading && !form) return <p className="muted">Loading…</p>
  if (!form) return null
  const needsPublish = form.status === 'draft' || form.unpublishedChanges

  return (
    <div className="form-page">
      <header className="page-head">
        <div>
          <p className="muted small">
            <Link to="/forms">Forms</Link> /
          </p>
          <h1>
            {form.name} <StatusBadge form={form} />
          </h1>
        </div>
        <div className="row">
          {can('editor') && (
            <span className={saving === 'failed' ? 'danger small' : 'muted small'} aria-live="polite">
              {saving === 'saving'
                ? 'Saving…'
                : saving === 'failed'
                  ? 'Could not save. Check your connection.'
                  : 'All changes saved'}
            </span>
          )}
          {form.status === 'published' && (
            <a className="button" href={`/f/${form.slug}`} target="_blank" rel="noreferrer">
              View form
            </a>
          )}
          {can('editor') && (
            <button
              className="button primary"
              disabled={!needsPublish}
              onClick={() => publish('publish')}
            >
              {form.status === 'draft' ? 'Publish' : needsPublish ? 'Publish changes' : 'Published'}
            </button>
          )}
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
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={tab === t.id ? 'tab active' : 'tab'}
            onClick={() => setParams(t.id === tabs[0].id ? {} : { tab: t.id })}
          >
            {t.label}
            {t.id === 'submissions' && form.submissions > 0 && (
              <span className="count">{form.submissions}</span>
            )}
          </button>
        ))}
      </nav>
      {tab === 'build' && (
        <div className="builder-area">
          <FormBuilder key={draftEpoch} defaultValue={form.schema} onChange={onSchema} components={components} />
        </div>
      )}
      {tab === 'submissions' && <Submissions form={form} />}
      {tab === 'settings' && (
        <Settings
          form={form}
          onSaved={(next) => setData({ form: next })}
          onUnpublish={() => publish('unpublish')}
        />
      )}
      {tab === 'share' && <Share form={form} />}
      {tab === 'reports' && <Reports form={form} />}
      {tab === 'versions' && (
        <Versions
          form={form}
          onRestored={(next) => {
            setData({ form: next })
            setDraftEpoch((n) => n + 1)
          }}
        />
      )}
    </div>
  )
}

function Submissions({ form }: { form: FormDetail }) {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [status, setStatus] = useState('')
  const size = 25
  const { data, error, loading } = useLoad(
    () =>
      api<{ submissions: Submission[]; total: number; columns: Column[] }>(
        `/forms/${form.id}/submissions?limit=${size}&offset=${page * size}&q=${encodeURIComponent(search)}&status=${status}`,
      ),
    [form.id, page, search, status],
  )
  if (error) return <div className="banner danger">{error.message}</div>
  const columns = (data?.columns ?? []).slice(0, 4)
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
          <input
            className="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search submissions"
            aria-label="Search submissions"
          />
          <button className="button">Search</button>
          <select
            aria-label="Filter by status"
            value={status}
            onChange={(e) => {
              setPage(0)
              setStatus(e.target.value)
            }}
          >
            <option value="">Any status</option>
            {STATUSES.map((st) => (
              <option key={st} value={st}>
                {STATUS_LABEL[st]}
              </option>
            ))}
          </select>
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
          <h2>{search || status ? 'Nothing matches' : 'No submissions yet'}</h2>
          <p className="muted">
            {search || status
              ? 'Try a different search or status.'
              : form.status === 'published'
                ? 'Share the form link to start collecting responses.'
                : 'Publish the form, then share its link.'}
          </p>
        </div>
      ) : (
        <table className="table card">
          <thead>
            <tr>
              <th>Submitted</th>
              <th>Status</th>
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
                <td>
                  <span className={STATUS_CLASS[s.status]}>{STATUS_LABEL[s.status]}</span>
                </td>
                {columns.map((c) => (
                  <td key={c.key}>{show(c.type === 'richText' && typeof s.data[c.key] === 'string' ? htmlToText(s.data[c.key] as string) : s.data[c.key])}</td>
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
          <button
            className="button"
            disabled={(page + 1) * size >= total}
            onClick={() => setPage(page + 1)}
          >
            Next
          </button>
        </div>
      )}
    </>
  )
}

/** An ISO moment as the local date and time a datetime-local input expects. */
function localInput(iso: string | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function Settings({
  form,
  onSaved,
  onUnpublish,
}: {
  form: FormDetail
  onSaved: (form: FormDetail) => void
  onUnpublish: () => void
}) {
  const navigate = useNavigate()
  const { can } = useAuth()
  const [error, setError] = useState<ApiError | null>(null)
  const [saved, setSaved] = useState(false)
  const [exposed, setExposed] = useState(() => new Set(form.settings.exposedFields ?? []))
  const { data } = useLoad(
    () => api<{ columns: Column[] }>(`/forms/${form.id}/submissions?limit=1`),
    [form.id],
  )

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
          settings: {
            successMessage: f.get('successMessage'),
            maxSubmissions: f.get('maxSubmissions'),
            closed: f.get('closed') === 'on',
            exposedFields: [...exposed],
            // The browser gives local time without a zone; turn it into an exact moment.
            opensAt: f.get('opensAt') ? new Date(String(f.get('opensAt'))).toISOString() : '',
            closesAt: f.get('closesAt') ? new Date(String(f.get('closesAt'))).toISOString() : '',
            notifyEmails: f.get('notifyEmails'),
          },
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
    navigate('/forms')
  }
  const fieldError = (name: string) =>
    error?.fields[name] && <small className="danger">{error.fields[name][0]}</small>

  return (
    <div className="settings">
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
            {fieldError('slug') ?? (
              <small className="muted">Changing this breaks links you have already shared.</small>
            )}
          </label>
          <label className="field">
            <span>Message after submitting</span>
            <input
              name="successMessage"
              defaultValue={form.settings.successMessage ?? ''}
              placeholder="Thank you. Your response has been recorded."
            />
          </label>
        </section>
        <section className="card stack">
          <h2>Limits</h2>
          <label className="field">
            <span>Maximum submissions</span>
            <input
              name="maxSubmissions"
              type="number"
              min="1"
              defaultValue={form.settings.maxSubmissions ?? ''}
              placeholder="No limit"
            />
          </label>
          <div className="row">
            <label className="field grow">
              <span>Opens</span>
              <input
                name="opensAt"
                type="datetime-local"
                defaultValue={localInput(form.settings.opensAt)}
              />
              {fieldError('opensAt')}
            </label>
            <label className="field grow">
              <span>Closes</span>
              <input
                name="closesAt"
                type="datetime-local"
                defaultValue={localInput(form.settings.closesAt)}
              />
              {fieldError('closesAt')}
            </label>
          </div>
          <label className="check">
            <input name="closed" type="checkbox" defaultChecked={!!form.settings.closed} />
            <span>Stop accepting responses now</span>
          </label>
        </section>
        <section className="card stack">
          <h2>Email notifications</h2>
          <label className="field">
            <span>Email these addresses for each new submission</span>
            <input
              name="notifyEmails"
              defaultValue={(form.settings.notifyEmails ?? []).join(', ')}
              placeholder="office@example.com, head@example.com"
              aria-invalid={!!error?.fields.notifyEmails}
            />
            {fieldError('notifyEmails') ?? (
              <small className="muted">Separate addresses with commas.</small>
            )}
          </label>
        </section>
        <section className="card stack">
          <h2>Data access</h2>
          <p className="muted">
            Tick the fields that lookup fields in your other forms may read from this form's
            submissions. Fields left unticked are never shared. Other forms refer to this one as{' '}
            <code>{form.slug}</code>.
          </p>
          {(data?.columns ?? []).length === 0 && (
            <p className="muted">This form has no fields yet.</p>
          )}
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
          {saved && (
            <span className="ok small" role="status">
              Saved
            </span>
          )}
          {error && !Object.keys(error.fields).length && (
            <span className="danger small">{error.message}</span>
          )}
        </div>
      </form>
      {/* Outside the settings form: a form cannot contain another form. */}
      <Webhooks form={form} />
      <section className="card stack">
        <h2>Danger zone</h2>
        <div className="row">
          {form.status === 'published' && (
            <button type="button" className="button" onClick={onUnpublish}>
              Unpublish
            </button>
          )}
          {can('admin') ? (
            <button type="button" className="button danger" onClick={remove}>
              Delete form
            </button>
          ) : (
            <span className="muted small">Only admins can delete a form.</span>
          )}
        </div>
      </section>
    </div>
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
          <input
            className="grow"
            readOnly
            value={url}
            aria-label="Public link"
            onFocus={(e) => e.target.select()}
          />
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

interface Note {
  id: string
  body: string
  author: string
  createdAt: number
}

export function SubmissionPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { can } = useAuth()
  const { data, error, loading, setData } = useLoad(
    () =>
      api<{
        submission: Submission
        form: { id: string; name: string }
        schema: FormSchema
        columns: Column[]
        notes: Note[]
      }>(`/submissions/${id}`),
    [id],
  )
  const [editing, setEditing] = useState(false)
  const [problem, setProblem] = useState<ApiError | null>(null)
  if (error)
    return (
      <div className="banner danger">
        {error.status === 404 ? 'This submission does not exist.' : error.message}
      </div>
    )
  if (loading || !data) return <p className="muted">Loading…</p>
  const { submission, form, columns, notes } = data
  const back = `/forms/${form.id}?tab=submissions`

  const remove = async () => {
    if (!confirm('Delete this submission? This cannot be undone.')) return
    await api(`/submissions/${id}`, { method: 'DELETE' })
    navigate(back)
  }
  const update = async (patch: { status?: Status; data?: unknown }) => {
    setProblem(null)
    try {
      const res = await api<{ submission: Submission }>(`/submissions/${id}`, {
        method: 'PATCH',
        body: patch,
      })
      setData({ ...data, submission: res.submission })
      setEditing(false)
    } catch (err) {
      setProblem(err as ApiError)
      throw err
    }
  }
  const addNote = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formEl = e.currentTarget
    const body = new FormData(formEl).get('body')
    try {
      const res = await api<{ notes: Note[] }>(`/submissions/${id}/notes`, {
        method: 'POST',
        body: { body },
      })
      setData({ ...data, notes: res.notes })
      formEl.reset()
    } catch (err) {
      setProblem(err as ApiError)
    }
  }
  const known = new Set(columns.map((c) => c.key))
  // Answers to fields that have since been removed from the form are still shown.
  const rows = [
    ...columns,
    ...Object.keys(submission.data)
      .filter((k) => !known.has(k))
      .map((key): Column => ({ key, label: key })),
  ]
  // Show a choice as the text the respondent saw ("Nepal"), not the stored value ("NP").
  const optionLabels = new Map<string, Map<string, string>>()
  const collect = (list: FormSchema['pages'][number]['components'] | undefined) => {
    for (const c of list ?? []) {
      if (c.key && c.options)
        optionLabels.set(c.key, new Map(c.options.map((o) => [String(o.value), o.label])))
      if (c.type !== 'repeater') collect(c.components)
      for (const col of c.columns ?? []) collect(col.components)
    }
  }
  for (const page of data.schema.pages) collect(page.components)
  const readable = (key: string, value: unknown): unknown => {
    const labels = optionLabels.get(key)
    if (!labels) return value
    return Array.isArray(value)
      ? value.map((v) => labels.get(String(v)) ?? v)
      : (labels.get(String(value)) ?? value)
  }

  return (
    <>
      <header className="page-head">
        <div>
          <p className="muted small">
            <Link to="/forms">Forms</Link> / <Link to={`/forms/${form.id}`}>{form.name}</Link> /{' '}
            <Link to={back}>Submissions</Link>
          </p>
          <h1>
            Submission{' '}
            <span className={STATUS_CLASS[submission.status]}>
              {STATUS_LABEL[submission.status]}
            </span>
          </h1>
          <p className="muted">
            {when(submission.createdAt)} · <code>{submission.id}</code>
          </p>
        </div>
        <div className="row">
          <label className="row tight">
            <span className="muted small">Status</span>
            <select
              value={submission.status}
              disabled={!can('reviewer')}
              onChange={(e) => void update({ status: e.target.value as Status }).catch(() => {})}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
          {can('editor') && (
            <button className="button" onClick={() => setEditing(!editing)}>
              {editing ? 'Cancel editing' : 'Edit answers'}
            </button>
          )}
          <button className="button" onClick={() => window.print()}>
            Print
          </button>
          {can('editor') && (
            <button className="button danger" onClick={remove}>
              Delete
            </button>
          )}
        </div>
      </header>
      {problem && (
        <div className="banner danger" role="alert">
          <strong>{problem.message}</strong>
          <ul>
            {Object.values(problem.fields)
              .flat()
              .map((m, i) => (
                <li key={i}>{m}</li>
              ))}
          </ul>
        </div>
      )}
      <div className="split">
        {editing ? (
          <div className="card grow">
            <Form
              schema={{ ...data.schema, submitLabel: 'Save answers' }}
              components={components}
              defaultValues={submission.data}
              onSubmit={(answers) => update({ data: answers })}
            />
          </div>
        ) : (
          <dl className="card answers grow">
            {rows.map((c) => {
              const value = submission.data[c.key]
              const nested =
                Array.isArray(value) && value.length > 0 && typeof value[0] === 'object'
              const file =
                value &&
                typeof value === 'object' &&
                'url' in value &&
                typeof value.url === 'string' &&
                value.url.startsWith('/api/files/')
                  ? (value as { url: string; name?: string })
                  : null
              return (
                <div key={c.key}>
                  <dt>{c.label}</dt>
                  <dd>
                    {typeof value === 'string' && value.startsWith('data:image/') ? (
                      <img className="signature" src={value} alt={`${c.label} (signature)`} />
                    ) : file ? (
                      <a href={file.url}>{file.name ?? 'Download file'}</a>
                    ) : c.type === 'richText' && typeof value === 'string' ? (
                      <RichTextView html={value} />
                    ) : nested ? (
                      <pre className="code">{JSON.stringify(value, null, 2)}</pre>
                    ) : (
                      show(readable(c.key, value))
                    )}
                  </dd>
                </div>
              )
            })}
          </dl>
        )}
        <section className="card stack side notes">
          <h2>Notes</h2>
          {notes.length === 0 && <p className="muted">Notes are only visible to your team.</p>}
          {notes.map((n) => (
            <div className="note" key={n.id}>
              <div className="pre-wrap">{n.body}</div>
              <div className="muted small">
                {n.author} · {when(n.createdAt)}
              </div>
            </div>
          ))}
          {can('reviewer') && (
            <form className="stack" onSubmit={addNote}>
              <textarea
                name="body"
                rows={3}
                required
                placeholder="Add a note"
                aria-label="Add a note"
              />
              <div>
                <button className="button">Add note</button>
              </div>
            </form>
          )}
        </section>
      </div>
    </>
  )
}

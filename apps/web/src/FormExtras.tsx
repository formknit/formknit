import { useState, type FormEvent } from 'react'
import { api, ApiError, STATUS_LABEL, STATUSES, useLoad, when, type FormDetail } from './api'
import { Breakdown, DayBars, Stat } from './Charts'

interface FieldReport {
  key: string
  label: string
  kind: 'choices' | 'numbers'
  answered: number
  counts?: { label: string; count: number }[]
  average?: number
  min?: number
  max?: number
  sum?: number
}
interface Report {
  total: number
  byStatus: Record<string, number>
  series: { day: string; count: number }[]
  fields: FieldReport[]
}

export function Reports({ form }: { form: FormDetail }) {
  const { data, error, loading } = useLoad(() => api<{ report: Report }>(`/forms/${form.id}/report`), [form.id])
  if (error) return <div className="banner danger">{error.message}</div>
  if (loading || !data) return <p className="muted">Loading…</p>
  const { report } = data
  if (report.total === 0) {
    return (
      <div className="card empty">
        <h2>No data yet</h2>
        <p className="muted">Reports appear once the form has submissions.</p>
      </div>
    )
  }
  const reviewed = report.byStatus.approved + report.byStatus.rejected
  return (
    <>
      <div className="stats">
        <Stat label="Submissions" value={report.total} />
        <Stat label="Approved" value={report.byStatus.approved} detail={reviewed ? `${Math.round((report.byStatus.approved / reviewed) * 100)}% of those reviewed` : 'None reviewed yet'} />
        <Stat label="Waiting" value={report.byStatus.new + report.byStatus.in_review} detail="New or in review" />
      </div>
      <div className="split">
        <section className="card stack grow">
          <h2>Submissions, last 30 days</h2>
          <DayBars series={report.series} />
        </section>
        <section className="card stack side">
          <h2>Status</h2>
          <Breakdown rows={STATUSES.map((s) => ({ label: STATUS_LABEL[s], count: report.byStatus[s] }))} />
        </section>
      </div>
      <div className="report-grid">
        {report.fields.map((f) => (
          <section className="card stack" key={f.key}>
            <h2>{f.label}</h2>
            {f.kind === 'choices' ? (
              <Breakdown rows={f.counts ?? []} />
            ) : f.answered === 0 ? (
              <p className="muted">No answers yet.</p>
            ) : (
              <dl className="numbers">
                <div>
                  <dt>Average</dt>
                  <dd>{f.average}</dd>
                </div>
                <div>
                  <dt>Total</dt>
                  <dd>{f.sum}</dd>
                </div>
                <div>
                  <dt>Lowest</dt>
                  <dd>{f.min}</dd>
                </div>
                <div>
                  <dt>Highest</dt>
                  <dd>{f.max}</dd>
                </div>
              </dl>
            )}
            <p className="muted small">
              {f.answered} of {report.total} answered
            </p>
          </section>
        ))}
      </div>
      {report.fields.length === 0 && <p className="muted">This form has no choice or number fields to summarise.</p>}
    </>
  )
}

interface Version {
  id: string
  version: number
  publishedAt: number
  fields: number
  pages: number
  live: boolean
}

export function Versions({ form, onRestored }: { form: FormDetail; onRestored: (form: FormDetail) => void }) {
  const { data, error, loading } = useLoad(() => api<{ versions: Version[] }>(`/forms/${form.id}/versions`), [form.id, form.publishedAt])
  const [restored, setRestored] = useState<number | null>(null)
  if (error) return <div className="banner danger">{error.message}</div>
  if (loading || !data) return <p className="muted">Loading…</p>
  if (data.versions.length === 0) {
    return (
      <div className="card empty">
        <h2>No versions yet</h2>
        <p className="muted">A version is saved each time you publish.</p>
      </div>
    )
  }
  const restore = async (v: Version) => {
    if (!confirm(`Replace the current draft with version ${v.version}? Respondents see no change until you publish.`)) return
    const res = await api<{ form: FormDetail }>(`/forms/${form.id}/versions/${v.id}/restore`, { method: 'POST', body: {} })
    onRestored(res.form)
    setRestored(v.version)
  }
  return (
    <div className="settings">
      {restored !== null && (
        <div className="banner ok-bg" role="status">
          Version {restored} is now your draft. Open Build to review it, then publish.
        </div>
      )}
      <section className="card stack">
        <h2>Published versions</h2>
        {data.versions.map((v) => (
          <div className="row line" key={v.id}>
            <div className="grow">
              <div className="strong">
                Version {v.version} {v.live && <span className="badge ok">Live</span>}
              </div>
              <div className="muted small">
                Published {when(v.publishedAt)} · {v.fields} {v.fields === 1 ? 'field' : 'fields'}
                {v.pages > 1 && ` · ${v.pages} pages`}
              </div>
            </div>
            <button className="button" onClick={() => restore(v)}>
              Restore as draft
            </button>
          </div>
        ))}
      </section>
    </div>
  )
}

interface Hook {
  id: string
  url: string
  active: boolean
  secret: string
  last: { ok: boolean; event: string; error: string | null; createdAt: number } | null
}

export function Webhooks({ form }: { form: FormDetail }) {
  const { data, reload } = useLoad(() => api<{ webhooks: Hook[] }>(`/forms/${form.id}/webhooks`), [form.id])
  const [error, setError] = useState<ApiError | null>(null)
  const [shown, setShown] = useState<string | null>(null)
  const base = `/forms/${form.id}/webhooks`
  const act = async (work: () => Promise<unknown>) => {
    setError(null)
    try {
      await work()
      reload()
    } catch (err) {
      setError(err as ApiError)
    }
  }
  const add = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formEl = e.currentTarget
    const url = new FormData(formEl).get('url')
    void act(async () => {
      await api(base, { method: 'POST', body: { url } })
      formEl.reset()
    })
  }
  return (
    <section className="card stack">
      <h2>Webhooks</h2>
      <p className="muted">
        Each new submission, and each status change, is sent to these addresses as JSON. Check the <code>x-formknit-signature</code> header with the secret to confirm it came from here.
      </p>
      {(data?.webhooks ?? []).map((hook) => (
        <div className="stack line" key={hook.id}>
          <div className="row">
            <div className="grow">
              <div className="strong breakable">{hook.url}</div>
              <div className={hook.last && !hook.last.ok ? 'danger small' : 'muted small'}>
                {!hook.active ? 'Paused' : hook.last ? `${hook.last.ok ? 'Delivered' : `Failed: ${hook.last.error}`} · ${when(hook.last.createdAt)}` : 'Nothing sent yet'}
              </div>
            </div>
            <button type="button" className="link" onClick={() => act(() => api(`${base}/${hook.id}/test`, { method: 'POST', body: {} }))}>
              Send test
            </button>
            <button type="button" className="link" onClick={() => setShown(shown === hook.id ? null : hook.id)}>
              {shown === hook.id ? 'Hide secret' : 'Show secret'}
            </button>
            <button type="button" className="link" onClick={() => act(() => api(`${base}/${hook.id}`, { method: 'PATCH', body: { active: !hook.active } }))}>
              {hook.active ? 'Pause' : 'Resume'}
            </button>
            <button type="button" className="link danger" onClick={() => confirm('Remove this webhook?') && act(() => api(`${base}/${hook.id}`, { method: 'DELETE' }))}>
              Remove
            </button>
          </div>
          {shown === hook.id && <pre className="code">{hook.secret}</pre>}
        </div>
      ))}
      <form className="row end" onSubmit={add}>
        <label className="field grow">
          <span>Add an address</span>
          <input name="url" type="url" required placeholder="https://example.com/hooks/formknit" aria-invalid={!!error?.fields.url} />
          {error?.fields.url && <small className="danger">{error.fields.url[0]}</small>}
        </label>
        <button className="button">Add webhook</button>
      </form>
      {error && !error.fields.url && <div className="banner danger">{error.message}</div>}
    </section>
  )
}

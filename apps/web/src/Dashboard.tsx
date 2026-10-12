import { Link } from 'react-router-dom'
import { api, STATUS_CLASS, STATUS_LABEL, useLoad, when, type Status } from './api'
import { useAuth } from './auth'
import { Breakdown, DayBars, Stat } from './Charts'

interface Dashboard {
  forms: number
  published: number
  submissions: number
  thisWeek: number
  awaitingReview: number
  series: { day: string; count: number }[]
  recent: { id: string; formId: string; formName: string; status: Status; createdAt: number }[]
  topForms: { id: string; name: string; submissions: number }[]
}

export function DashboardPage() {
  const { user } = useAuth()
  const { data, error, loading } = useLoad(() => api<Dashboard>('/dashboard'), [])
  if (error) return <div className="banner danger">{error.message}</div>
  if (loading || !data) return <p className="muted">Loading…</p>
  return (
    <>
      <header className="page-head">
        <div>
          <p className="muted">Welcome back, {user?.name.split(' ')[0]}</p>
          <h1>Dashboard</h1>
        </div>
        <Link className="button primary" to="/forms">
          Go to forms
        </Link>
      </header>
      <div className="stats">
        <Stat label="Forms" value={data.forms} detail={`${data.published} published`} />
        <Stat label="Submissions" value={data.submissions} detail={`${data.thisWeek} in the last 7 days`} />
        <Stat label="Awaiting review" value={data.awaitingReview} detail="New or in review" />
      </div>
      {data.forms === 0 ? (
        <div className="card empty">
          <h2>Nothing here yet</h2>
          <p className="muted">Create a form to start collecting responses.</p>
        </div>
      ) : (
        <div className="split">
          <section className="card stack grow">
            <h2>Submissions, last 14 days</h2>
            <DayBars series={data.series} />
          </section>
          <section className="card stack side">
            <h2>Most active forms</h2>
            <Breakdown rows={data.topForms.map((f) => ({ label: f.name, count: f.submissions }))} />
          </section>
        </div>
      )}
      {data.recent.length > 0 && (
        <table className="table card">
          <thead>
            <tr>
              <th>Recent submissions</th>
              <th>Status</th>
              <th>Submitted</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data.recent.map((r) => (
              <tr key={r.id}>
                <td>
                  <Link to={`/forms/${r.formId}?tab=submissions`}>{r.formName}</Link>
                </td>
                <td>
                  <span className={STATUS_CLASS[r.status]}>{STATUS_LABEL[r.status]}</span>
                </td>
                <td>{when(r.createdAt)}</td>
                <td className="actions">
                  <Link to={`/submissions/${r.id}`}>View</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}

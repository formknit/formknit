/** A row of vertical bars, one per day. */
export function DayBars({ series }: { series: { day: string; count: number }[] }) {
  const max = Math.max(1, ...series.map((s) => s.count))
  const total = series.reduce((n, s) => n + s.count, 0)
  return (
    <div className="bars" role="img" aria-label={`${total} submissions over the last ${series.length} days`}>
      {series.map((s) => (
        <div className="bar-slot" key={s.day} title={`${s.day}: ${s.count}`}>
          <div className="bar" style={{ height: `${Math.max(2, (s.count / max) * 100)}%`, opacity: s.count ? 1 : 0.25 }} />
          <span className="bar-label">{Number(s.day.slice(8))}</span>
        </div>
      ))}
    </div>
  )
}

/** Horizontal bars for comparing a few named amounts. */
export function Breakdown({ rows }: { rows: { label: string; count: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.count))
  const total = rows.reduce((n, r) => n + r.count, 0)
  return (
    <div className="breakdown">
      {rows.map((r) => (
        <div className="breakdown-row" key={r.label}>
          <span className="breakdown-label">{r.label}</span>
          <span className="track">
            <span className="fill" style={{ width: `${(r.count / max) * 100}%` }} />
          </span>
          <span className="muted small breakdown-value">
            {r.count}
            {total > 0 && ` · ${Math.round((r.count / total) * 100)}%`}
          </span>
        </div>
      ))}
    </div>
  )
}

export function Stat({ label, value, detail }: { label: string; value: string | number; detail?: string }) {
  return (
    <div className="card stat">
      <span className="muted">{label}</span>
      <strong>{value}</strong>
      {detail && <span className="muted small">{detail}</span>}
    </div>
  )
}

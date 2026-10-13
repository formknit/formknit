import type { FormSchema, LookupQuery } from '@formknit/core'
import { Form } from '@formknit/react'
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { api, ApiError, components, useLoad } from './api'

/** Sends a file to the server, trying each file field of the form until one accepts it. */
async function upload(slug: string, schema: FormSchema, file: File): Promise<unknown> {
  const keys: string[] = []
  const visit = (list: FormSchema['pages'][number]['components'] | undefined) => {
    for (const c of list ?? []) {
      if (c.type === 'file' && c.key) keys.push(c.key)
      visit(c.components)
      for (const col of c.columns ?? []) visit(col.components)
    }
  }
  for (const page of schema.pages) visit(page.components)
  let last: Error = new Error('This form has no file field')
  for (const key of keys) {
    const body = new FormData()
    body.set('file', file)
    const res = await fetch(`/api/public/forms/${slug}/files?field=${encodeURIComponent(key)}`, { method: 'POST', body })
    const json = await res.json().catch(() => null)
    if (res.ok) return json
    last = new Error(json?.error?.message ?? 'The upload failed')
  }
  throw last
}

/** The page respondents see. It needs no account. */
export function PublicForm() {
  const { slug = '' } = useParams()
  const { data, error, loading } = useLoad(() => api<{ name: string; schema: FormSchema; closed: boolean; reason: string | null; opensAt: string | null }>(`/public/forms/${slug}`), [slug])
  const [done, setDone] = useState<string | null>(null)
  const [problem, setProblem] = useState<ApiError | null>(null)

  const card = (title: string, text: string, good = false) => (
    <div className="center">
      <div className="card notice">
        <span className={good ? 'dot ok' : 'dot'} />
        <h1>{title}</h1>
        <p className="muted">{text}</p>
        {good && (
          <button className="button" onClick={() => setDone(null)}>
            Submit another response
          </button>
        )}
      </div>
    </div>
  )
  if (loading) return <div className="center muted">Loading…</div>
  if (error) return card(error.status === 404 ? 'Form not found' : 'Something went wrong', error.status === 404 ? 'This form does not exist, or it is not published.' : error.message)
  if (!data) return null
  if (done !== null) return card('Response received', done, true)
  if (data.reason === 'not_open') return card('This form is not open yet', data.opensAt ? `It opens on ${new Date(data.opensAt).toLocaleString(undefined, { dateStyle: 'long', timeStyle: 'short' })}.` : 'Please come back later.')
  if (data.reason === 'full') return card('This form is full', 'It has received all the responses it can take.')
  if (data.closed) return card('This form is closed', 'It is no longer accepting responses.')

  return (
    <div className="public">
      <div className="card public-card">
        <Form
          // A fresh form after each successful submit.
          key={String(done)}
          schema={data.schema}
          components={components}
          draft={{ key: `formknit:${slug}` }}
          lookup={(query: LookupQuery) => api<{ value: unknown }>(`/public/forms/${slug}/lookup`, { method: 'POST', body: query }).then((r) => r.value)}
          // onUpload is called for one field at a time, so the form tells us which through `upload`.
          onUpload={(file) => upload(slug, data.schema, file)}
          onSubmit={async (answers) => {
            setProblem(null)
            try {
              const res = await api<{ message: string }>(`/public/forms/${slug}/submissions`, { method: 'POST', body: answers })
              setDone(res.message)
            } catch (err) {
              setProblem(err as ApiError)
              // Rethrow so the draft is kept: the answers were not accepted.
              throw err
            }
          }}
        >
          {problem && (
            <div className="banner danger" role="alert">
              <strong>{problem.message}</strong>
              {Object.keys(problem.fields).length > 0 && (
                <ul>
                  {Object.values(problem.fields).flat().map((message, i) => (
                    <li key={i}>{message}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </Form>
      </div>
      <p className="muted small centered">Powered by Formknit</p>
    </div>
  )
}

import type { FormSchema, LookupQuery } from '@formknit/core'
import { Form } from '@formknit/react'
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { api, ApiError, useLoad } from './api'

/** The page respondents see. It needs no account. */
export function PublicForm() {
  const { slug = '' } = useParams()
  const { data, error, loading } = useLoad(() => api<{ name: string; schema: FormSchema; closed: boolean }>(`/public/forms/${slug}`), [slug])
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
  if (data.closed) return card('This form is closed', 'It is no longer accepting responses.')

  return (
    <div className="public">
      <div className="card public-card">
        <Form
          // A fresh form after each successful submit.
          key={String(done)}
          schema={data.schema}
          draft={{ key: `formknit:${slug}` }}
          lookup={(query: LookupQuery) => api<{ value: unknown }>(`/public/forms/${slug}/lookup`, { method: 'POST', body: query }).then((r) => r.value)}
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

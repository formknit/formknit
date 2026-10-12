import { FormBuilder } from '@formknit/builder'
import '@formknit/builder/styles.css'
import { Form, useForm, useFormState } from '@formknit/react'
import '@formknit/react/styles.css'
import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { examples } from './examples'
import './playground.css'

type Name = keyof typeof examples

function Example({ name }: { name: Name }) {
  const schema = examples[name]
  const [submitted, setSubmitted] = useState<unknown>(null)
  const form = useForm(schema, { onSubmit: (data) => setSubmitted(data) })
  const { state } = useFormState(form)
  const errorCount = Object.keys(state.errors).length
  return (
    <div className="pg-body">
      <main className="pg-stage">
        <div className="pg-card">
          <Form schema={schema} form={form} />
        </div>
      </main>
      <aside className="pg-side">
        <h2>Submission data</h2>
        <p className="pg-muted">Updates as you type. Hidden fields are left out.</p>
        <pre className="pg-code">{JSON.stringify(state.data, null, 2)}</pre>
        <div className={errorCount ? 'pg-status pg-bad' : 'pg-status pg-good'}>
          {errorCount ? `${errorCount} ${errorCount === 1 ? 'field needs' : 'fields need'} attention` : 'Ready to submit'}
        </div>
        {submitted !== null && (
          <>
            <h2>Last submitted</h2>
            <pre className="pg-code">{JSON.stringify(submitted, null, 2)}</pre>
          </>
        )}
      </aside>
    </div>
  )
}

function App() {
  const names = Object.keys(examples) as Name[]
  const [tab, setTab] = useState<Name | 'Builder'>('Builder')
  return (
    <>
      <header className="pg-top">
        <strong>Formknit playground</strong>
        <nav className="pg-tabs">
          {(['Builder', ...names] as const).map((n) => (
            <button key={n} className={n === tab ? 'pg-tab pg-active' : 'pg-tab'} onClick={() => setTab(n)}>
              {n}
            </button>
          ))}
        </nav>
      </header>
      {tab === 'Builder' ? (
        <div className="pg-builder">
          <FormBuilder defaultValue={examples['Admission form']} />
        </div>
      ) : (
        <Example key={tab} name={tab} />
      )}
    </>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

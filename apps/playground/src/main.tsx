import { muiAdapter } from '@formknit/adapter-mui'
import { FormBuilder } from '@formknit/builder'
import '@formknit/builder/styles.css'
import { Form, useForm, useFormState } from '@formknit/react'
import '@formknit/react/styles.css'
import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { examples } from './examples'
import './playground.css'

type Name = keyof typeof examples

function Example({ name, mui }: { name: Name; mui: boolean }) {
  const schema = examples[name]
  const [submitted, setSubmitted] = useState<unknown>(null)
  const form = useForm(schema, { onSubmit: (data) => setSubmitted(data) })
  const { state } = useFormState(form)
  const errorCount = Object.keys(state.errors).length
  return (
    <div className="pg-body">
      <main className="pg-stage">
        <div className="pg-card">
          <Form schema={schema} form={form} components={mui ? muiAdapter : undefined} />
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
  const [mui, setMui] = useState(false)
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
        <span className="pg-grow" />
        <span className="pg-muted-label">Components</span>
        <nav className="pg-tabs">
          {[false, true].map((on) => (
            <button key={String(on)} className={on === mui ? 'pg-tab pg-active' : 'pg-tab'} onClick={() => setMui(on)}>
              {on ? 'Material UI' : 'Default'}
            </button>
          ))}
        </nav>
      </header>
      {tab === 'Builder' ? (
        <div className="pg-builder">
          <FormBuilder defaultValue={examples['Admission form']} components={mui ? muiAdapter : undefined} />
        </div>
      ) : (
        <Example key={tab} name={tab} mui={mui} />
      )}
    </>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

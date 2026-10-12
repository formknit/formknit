import { checkSchema, type ComponentSchema, type FormSchema } from '@formknit/core'
import { defaultAdapter, Form, useForm, useFormState, type Adapter, type PartialAdapter } from '@formknit/react'
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Canvas, performDrop } from './Canvas'
import { BuilderContext, cx, Icon, useBuilder, type Builder, type Drag } from './context'
import { iconFor, newComponent, paletteGroups } from './meta'
import { clone, componentAt, findPath, isData, listAt, parsePath, pathKey, uniqueKey, type Path } from './ops'
import { Settings } from './Settings'

export const emptySchema = (): FormSchema => ({ version: 1, pages: [{ key: 'page1', components: [] }] })

export interface FormBuilderProps {
  /** The schema to edit. Pass it together with `onChange` to control the builder. */
  value?: FormSchema
  /** The schema to start from when the builder keeps its own state. */
  defaultValue?: FormSchema
  /** Called with a new schema object after every edit, undo and redo. */
  onChange?: (schema: FormSchema) => void
  /** Components used for previews, matching the ones your forms render with. */
  components?: PartialAdapter
  className?: string
}

type View = 'build' | 'preview' | 'json'

function Palette() {
  const b = useBuilder()
  return (
    <nav className="fxb-palette" aria-label="Fields">
      {paletteGroups().map(({ group, fields }) => (
        <div className="fxb-group" key={group}>
          <div className="fxb-group-title">{group}</div>
          {fields.map((f) => (
            <button
              key={f.type}
              type="button"
              className="fxb-palette-item"
              draggable
              title={`Add ${f.label}`}
              onClick={() => b.add(f.type)}
              onDragStart={(e) => {
                e.dataTransfer?.setData('text/plain', f.type)
                if (e.dataTransfer) e.dataTransfer.effectAllowed = 'copy'
                b.setDrag({ kind: 'new', type: f.type })
              }}
              onDragEnd={() => b.setDrag(null)}
            >
              <span className="fxb-palette-icon">
                <Icon markup={iconFor(f.type)} size={14} />
              </span>
              {f.label}
            </button>
          ))}
        </div>
      ))}
    </nav>
  )
}

function PreviewPane({ schema, components }: { schema: FormSchema; components?: PartialAdapter }) {
  const [submitted, setSubmitted] = useState<unknown>(null)
  const form = useForm(schema, { onSubmit: (data) => setSubmitted(data) })
  const { state } = useFormState(form)
  return (
    <div className="fxb-preview-pane">
      <div className="fxb-preview-stage">
        <div className="fxb-sheet">
          <Form schema={schema} form={form} components={components} />
        </div>
      </div>
      <aside className="fxb-settings" aria-label="Submission data">
        <div className="fxb-settings-title">Submission data</div>
        <div className="fxb-help">Updates as you type. Hidden fields are left out.</div>
        <pre className="fxb-json-view">{JSON.stringify(state.data, null, 2)}</pre>
        {submitted !== null && (
          <>
            <div className="fxb-settings-title">Last submitted</div>
            <pre className="fxb-json-view">{JSON.stringify(submitted, null, 2)}</pre>
          </>
        )}
      </aside>
    </div>
  )
}

function JsonPane({ schema, onReplace }: { schema: FormSchema; onReplace: (schema: FormSchema) => void }) {
  const [text, setText] = useState(() => JSON.stringify(schema, null, 2))
  const [error, setError] = useState<string | null>(null)
  return (
    <div className="fxb-json-pane">
      <label className="fxb-setting-label" htmlFor="fxb-json">
        Schema JSON. Valid edits are applied as you type.
      </label>
      <textarea
        id="fxb-json"
        className={cx('fxb-input fxb-code fxb-json-editor', error && 'fxb-bad')}
        value={text}
        spellCheck={false}
        onChange={(e) => {
          setText(e.target.value)
          try {
            const parsed = JSON.parse(e.target.value)
            if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.pages) || parsed.pages.length === 0) {
              return setError('A schema needs a "pages" list with at least one page')
            }
            if (parsed.pages.some((p: unknown) => !p || typeof p !== 'object' || !Array.isArray((p as { components?: unknown }).components))) {
              return setError('Every page needs a "components" list')
            }
            setError(null)
            onReplace(parsed)
          } catch (err) {
            setError(err instanceof Error ? err.message : String(err))
          }
        }}
      />
      {error && (
        <div className="fxb-error" role="alert">
          {error}
        </div>
      )}
    </div>
  )
}

/** The visual form builder: a palette of fields, a canvas to arrange them, and their settings. */
export function FormBuilder(props: FormBuilderProps) {
  const [hist, setHist] = useState(() => ({
    past: [] as FormSchema[],
    present: props.value ?? props.defaultValue ?? emptySchema(),
    future: [] as FormSchema[],
  }))
  const schema = hist.present
  const [view, setView] = useState<View>('build')
  const [pageIndexRaw, setPageIndex] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const [drag, setDragState] = useState<Drag | null>(null)
  const [indicator, setIndicator] = useState<Builder['indicator']>(null)
  // Bumped whenever the schema changes other than through the settings panel, so its local state resets.
  const [epoch, setEpoch] = useState(0)
  const emitted = useRef(schema)
  const lastEdit = useRef({ key: '', time: 0 })
  const pageIndex = Math.min(pageIndexRaw, schema.pages.length - 1)

  // A controlled builder follows `value` when the parent sets something we did not just emit.
  useEffect(() => {
    if (props.value && props.value !== emitted.current) {
      emitted.current = props.value
      setHist({ past: [], present: props.value, future: [] })
      setSelected(null)
      setEpoch((n) => n + 1)
    }
  }, [props.value])

  const adapter = useMemo<Adapter>(
    () => ({
      fields: { ...defaultAdapter.fields, ...props.components?.fields } as Adapter['fields'],
      layout: { ...defaultAdapter.layout, ...props.components?.layout } as Adapter['layout'],
      ui: { ...defaultAdapter.ui, ...props.components?.ui },
    }),
    [props.components],
  )

  const commit = (next: FormSchema, coalesce?: string) => {
    const now = Date.now()
    const merge = !!coalesce && lastEdit.current.key === coalesce && now - lastEdit.current.time < 1500
    lastEdit.current = { key: coalesce ?? '', time: now }
    setHist((h) => ({ past: merge ? h.past : [...h.past, h.present].slice(-100), present: next, future: [] }))
    emitted.current = next
    props.onChange?.(next)
  }

  const apply: Builder['apply'] = (edit, coalesce) => {
    const draft = clone(schema)
    const select = edit(draft)
    commit(draft, coalesce)
    if (select === undefined) return
    const path = select ? findPath(draft, select) : null
    setSelected(path ? pathKey(path) : null)
    if (path) setPageIndex(path[0] as number)
  }

  const travel = (direction: 'undo' | 'redo') => {
    const from = direction === 'undo' ? hist.past : hist.future
    if (!from.length) return
    const next = direction === 'undo' ? from[from.length - 1] : from[0]
    setHist({
      past: direction === 'undo' ? hist.past.slice(0, -1) : [...hist.past, hist.present],
      present: next,
      future: direction === 'undo' ? [hist.present, ...hist.future] : hist.future.slice(1),
    })
    lastEdit.current = { key: '', time: 0 }
    emitted.current = next
    props.onChange?.(next)
    if (selected && !componentAt(next, parsePath(selected))) setSelected(null)
    setEpoch((n) => n + 1)
  }

  const create = (draft: FormSchema) => (type: string): ComponentSchema => {
    const c = newComponent(type)
    if (isData(c)) c.key = uniqueKey(draft, type)
    return c
  }

  const builder: Builder = {
    schema,
    adapter,
    pageIndex,
    setPageIndex,
    selected,
    select: setSelected,
    apply,
    replace: (next, coalesce) => {
      commit(next, coalesce)
      setSelected(null)
      setEpoch((n) => n + 1)
    },
    drag,
    setDrag: (next) => {
      setDragState(next)
      if (!next) setIndicator(null)
    },
    indicator,
    setIndicator,
    drop: (listPath: Path, index: number) => {
      const current = drag
      setDragState(null)
      setIndicator(null)
      if (current) apply((draft) => performDrop(draft, current, listPath, index, create(draft)))
    },
    startTouchDrag: (current) => {
      // Browsers do not fire drag events for touch, so follow the finger ourselves.
      setDragState(current)
      let target: { listPath: Path; index: number } | null = null
      const move = (e: TouchEvent) => {
        e.preventDefault()
        const touch = e.touches[0]
        const list = touch ? (document.elementFromPoint(touch.clientX, touch.clientY)?.closest('[data-list]') as HTMLElement | null) : null
        const key = list?.getAttribute('data-list')
        // Not over a list, or over a list inside the component being dragged.
        if (!list || !key || (current.kind === 'move' && `${key}/`.startsWith(`${current.path}/`))) {
          target = null
          return setIndicator(null)
        }
        const cards = [...list.children].filter((el) => el.hasAttribute('data-card'))
        let index = cards.length
        for (let i = 0; i < cards.length; i++) {
          const rect = cards[i].getBoundingClientRect()
          if (touch.clientY < rect.top + rect.height / 2) {
            index = i
            break
          }
        }
        target = { listPath: parsePath(key), index }
        setIndicator({ list: key, index })
      }
      const end = () => {
        document.removeEventListener('touchmove', move)
        document.removeEventListener('touchend', end)
        document.removeEventListener('touchcancel', end)
        setDragState(null)
        setIndicator(null)
        const at = target
        if (at) apply((draft) => performDrop(draft, current, at.listPath, at.index, create(draft)))
      }
      document.addEventListener('touchmove', move, { passive: false })
      document.addEventListener('touchend', end)
      document.addEventListener('touchcancel', end)
    },
    add: (type) =>
      apply((draft) => {
        // Next to the selected field if there is one, otherwise at the end of the page.
        const at = selected ? parsePath(selected) : null
        const listPath = at ? at.slice(0, -1) : [pageIndex]
        const list = listAt(draft, listPath) ?? []
        const index = at ? (at[at.length - 1] as number) + 1 : list.length
        return performDrop(draft, { kind: 'new', type }, listPath, index, create(draft))
      }),
  }

  const issues = useMemo(() => checkSchema(schema), [schema])
  const onKeyDown = (e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement).tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
    if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'z') return
    e.preventDefault()
    travel(e.shiftKey ? 'redo' : 'undo')
  }

  return (
    <BuilderContext.Provider value={builder}>
      <div className={cx('fxb', props.className)} onKeyDown={onKeyDown}>
        <div className="fxb-top">
          <div className="fxb-segment" role="tablist" aria-label="View">
            {(['build', 'preview', 'json'] as const).map((v) => (
              <button key={v} type="button" role="tab" aria-selected={view === v} className={cx(view === v && 'fxb-active')} onClick={() => setView(v)}>
                {v === 'build' ? 'Build' : v === 'preview' ? 'Preview' : 'JSON'}
              </button>
            ))}
          </div>
          <span className="fxb-spacer" />
          <span className={cx('fxb-status', issues.length > 0 && 'fxb-status-bad')}>
            {issues.length === 0 ? 'No problems' : `${issues.length} ${issues.length === 1 ? 'problem' : 'problems'}`}
          </span>
          <button type="button" className="fxb-button" disabled={!hist.past.length} onClick={() => travel('undo')}>
            Undo
          </button>
          <button type="button" className="fxb-button" disabled={!hist.future.length} onClick={() => travel('redo')}>
            Redo
          </button>
        </div>
        {issues.length > 0 && (
          <ul className="fxb-issues" aria-label="Problems">
            {issues.slice(0, 4).map((issue, i) => (
              <li key={i} className={cx(issue.level === 'error' ? 'fxb-issue-error' : 'fxb-issue-warning')}>
                <strong>{issue.path}</strong> {issue.message}
              </li>
            ))}
            {issues.length > 4 && <li>and {issues.length - 4} more</li>}
          </ul>
        )}
        {view === 'build' && (
          <div className="fxb-body">
            <Palette />
            <Canvas />
            <Settings key={epoch} />
          </div>
        )}
        {view === 'preview' && <PreviewPane schema={schema} components={props.components} />}
        {view === 'json' && <JsonPane schema={schema} onReplace={(next) => builder.replace(next, 'json')} />}
      </div>
    </BuilderContext.Provider>
  )
}

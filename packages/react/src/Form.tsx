import { getField, type ComponentSchema, type FormSchema } from '@formknit/core'
import { memo, useEffect, useId, useMemo, useRef, useSyncExternalStore, type FormEvent, type ReactNode } from 'react'
import { FormProvider, useField, useForm, useFormContext, useFormState } from './hooks'
import { defaultAdapter } from './skin'
import type { FormOptions, FormStore } from './store'
import { defaultLabels, type Adapter, type DataOf, type Labels, type PartialAdapter } from './types'

const join = (a: string, b: string) => (a ? `${a}.${b}` : b)

function Unknown({ type }: { type: string }) {
  const { labels } = useFormContext()
  return <div className="fx-unknown">{labels.unknownField(type)}</div>
}

const FieldItem = memo(function FieldItem({ component: c, rowPath }: { component: ComponentSchema; rowPath: string }) {
  const { store, adapter, idPrefix } = useFormContext()
  const path = join(rowPath, c.key!)
  const field = useField(path)
  const Component = adapter.fields[c.type]
  if (!Component) return <Unknown type={c.type} />
  const onChange = (value: unknown) => {
    const upload = store.options.onUpload
    if (typeof File !== 'undefined' && value instanceof File) {
      // Keep something serialisable in the data: the upload result, or the file's details.
      const describe = { name: value.name, size: value.size, type: value.type }
      if (!upload) return field.setValue(describe)
      return void Promise.resolve(upload(value)).then((stored) => field.setValue(stored ?? describe))
    }
    field.setValue(value)
  }
  return (
    // `display: contents`, so this wrapper never affects an adapter's layout.
    <div className="fx-slot" data-fx-path={path}>
      <Component
        id={`${idPrefix}-${path.replace(/\./g, '-')}`}
        path={path}
        component={c}
        label={c.label}
        description={c.description}
        placeholder={c.placeholder}
        options={c.options ?? []}
        value={field.value}
        onChange={onChange}
        onBlur={field.onBlur}
        error={field.error}
        required={field.required}
        disabled={field.disabled}
      />
    </div>
  )
})

const RepeaterItem = memo(function RepeaterItem({ component: c, rowPath }: { component: ComponentSchema; rowPath: string }) {
  const { store, adapter, labels, idPrefix } = useFormContext()
  const path = join(rowPath, c.key!)
  const field = useField(path)
  const count = useSyncExternalStore(
    store.subscribe,
    () => store.rowCount(path),
    () => store.rowCount(path),
  )
  const max = c.validate?.maxItems
  const rows = Array.from({ length: count }, (_, index) => ({
    index,
    path: `${path}.${index}`,
    children: <Components list={c.components} rowPath={`${path}.${index}`} />,
    remove: () => store.removeRow(path, index),
    moveUp: index > 0 ? () => store.moveRow(path, index, index - 1) : undefined,
    moveDown: index < count - 1 ? () => store.moveRow(path, index, index + 1) : undefined,
  }))
  const Repeater = adapter.layout.repeater
  return (
    <div className="fx-slot" data-fx-path={path}>
      <Repeater
        id={`${idPrefix}-${path.replace(/\./g, '-')}`}
        path={path}
        component={c}
        label={c.label}
        description={c.description}
        rows={rows}
        add={!field.disabled && (max === undefined || count < max) ? () => store.addRow(path) : undefined}
        error={field.error}
        required={field.required}
        disabled={field.disabled}
        labels={labels}
      />
    </div>
  )
})

const Item = memo(function Item({ component: c, rowPath }: { component: ComponentSchema; rowPath: string }) {
  const { store, adapter } = useFormContext()
  const get = () => store.isVisible(c, rowPath)
  const visible = useSyncExternalStore(store.subscribe, get, get)
  if (!visible) return null
  const kind = getField(c.type)?.kind
  if (kind === 'input' || kind === 'calculated') return c.key ? <FieldItem component={c} rowPath={rowPath} /> : null
  if (kind === 'repeater') return c.key ? <RepeaterItem component={c} rowPath={rowPath} /> : null
  if (kind === 'content') {
    const Content = adapter.layout[c.type] ?? adapter.layout.content
    return <Content component={c} />
  }
  if (kind === 'layout') {
    if (c.type === 'columns') {
      const Columns = adapter.layout.columns
      const columns = (c.columns ?? []).map((col) => ({
        width: col.width ?? 1,
        children: <Components list={col.components} rowPath={rowPath} />,
      }))
      return <Columns component={c} columns={columns} />
    }
    const Layout = adapter.layout[c.type] ?? adapter.layout.panel
    return (
      <Layout component={c}>
        <Components list={c.components} rowPath={rowPath} />
      </Layout>
    )
  }
  return <Unknown type={c.type} />
})

const Components = memo(function Components({ list, rowPath }: { list: ComponentSchema[] | undefined; rowPath: string }) {
  return (
    <>
      {(list ?? []).map((c, i) => (
        <Item key={c.key ?? `#${i}`} component={c} rowPath={rowPath} />
      ))}
    </>
  )
})

export interface FormProps<S extends FormSchema> extends FormOptions<DataOf<S>> {
  schema: S
  /** A store from `useForm`, to control the form from outside. The option props are then ignored. */
  form?: FormStore<DataOf<S>>
  /** Components to render with. Anything left out falls back to the built-in skin. */
  components?: PartialAdapter
  /** Text for buttons and step labels. */
  labels?: Partial<Labels>
  className?: string
  /** Rendered between the fields and the buttons. */
  children?: ReactNode
}

/** Renders a form schema: fields, pages, validation messages and navigation. */
export function Form<S extends FormSchema>(props: FormProps<S>) {
  const { schema, form, components, labels: labelOverrides, className, children, ...options } = props
  const own = useForm(schema, options)
  const store = form ?? own
  const snap = useFormState(store)
  const idPrefix = useId().replace(/:/g, '')
  const root = useRef<HTMLFormElement>(null)
  const pendingFocus = useRef<string | null>(null)

  const adapter = useMemo<Adapter>(
    () => ({
      fields: { ...defaultAdapter.fields, ...components?.fields } as Adapter['fields'],
      layout: { ...defaultAdapter.layout, ...components?.layout } as Adapter['layout'],
      ui: { ...defaultAdapter.ui, ...components?.ui },
    }),
    [components],
  )
  const labels = useMemo<Labels>(() => ({ ...defaultLabels, ...labelOverrides }), [labelOverrides])

  // The store asks for focus before React has shown the right page, so remember it and act after rendering.
  store.focusField = (path) => {
    pendingFocus.current = path
  }
  useEffect(() => {
    const path = pendingFocus.current
    if (!path) return
    pendingFocus.current = null
    const slot = root.current?.querySelector(`[data-fx-path="${path.replace(/"/g, '\\"')}"]`)
    slot?.querySelector<HTMLElement>('input, select, textarea, button')?.focus()
  })

  const page = snap.pages[snap.step]
  const last = snap.step >= snap.pages.length - 1
  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (last) void store.submit()
    else store.next()
  }
  const { Button, Steps } = adapter.ui
  const pageSchema = page ? schema.pages[page.index] : undefined

  return (
    <FormProvider store={store} adapter={adapter} labels={labels} idPrefix={idPrefix}>
      <form ref={root} className={['fx-form', className].filter(Boolean).join(' ')} noValidate onSubmit={onSubmit}>
        {(schema.title || schema.description) && (
          <header className="fx-header">
            {schema.title && <h2 className="fx-title">{schema.title}</h2>}
            {schema.description && <p className="fx-text">{schema.description}</p>}
          </header>
        )}
        {snap.pages.length > 1 && <Steps pages={snap.pages} step={snap.step} />}
        {snap.pages.length > 1 && pageSchema && (pageSchema.title || pageSchema.description) && (
          <div className="fx-page-header">
            {pageSchema.title && <h3 className="fx-heading">{pageSchema.title}</h3>}
            {pageSchema.description && <p className="fx-text">{pageSchema.description}</p>}
          </div>
        )}
        <div className="fx-stack" key={page?.key}>
          <Components list={pageSchema?.components} rowPath="" />
        </div>
        {children}
        <div className="fx-actions">
          {snap.step > 0 && (
            <Button type="button" variant="secondary" onClick={() => store.back()}>
              {labels.back}
            </Button>
          )}
          <Button type="submit" variant="primary" disabled={snap.submitting}>
            {last ? (schema.submitLabel ?? labels.submit) : labels.next}
          </Button>
          {snap.pages.length > 1 && <span className="fx-step-count">{labels.step(snap.step + 1, snap.pages.length)}</span>}
        </div>
      </form>
    </FormProvider>
  )
}

import type { FormSchema } from '@formknit/core'
import { createContext, useContext, useEffect, useMemo, useRef, useSyncExternalStore, type ReactNode } from 'react'
import { FormStore, type FieldSnapshot, type FormOptions, type FormSnapshot } from './store'
import { defaultLabels, type Adapter, type DataOf, type Labels } from './types'

interface Context {
  store: FormStore<any>
  adapter: Adapter
  labels: Labels
  idPrefix: string
}

const FormContext = createContext<Context | null>(null)

export function FormProvider(props: Context & { children: ReactNode }) {
  const { children, store, adapter, labels, idPrefix } = props
  // A stable value, so fields re-render from their own subscriptions and not whenever the form does.
  const value = useMemo(() => ({ store, adapter, labels, idPrefix }), [store, adapter, labels, idPrefix])
  return <FormContext.Provider value={value}>{children}</FormContext.Provider>
}

export function useFormContext(): Context {
  const ctx = useContext(FormContext)
  if (!ctx) throw new Error('This component must be rendered inside <Form>')
  return ctx
}

/**
 * Creates the state for one form. Use it for a headless form, or to control a `<Form>` from outside
 * (`<Form form={form} />`). The returned store is stable for the life of the component.
 */
export function useForm<S extends FormSchema>(schema: S, options: FormOptions<DataOf<S>> = {}): FormStore<DataOf<S>> {
  const ref = useRef<FormStore<DataOf<S>> | null>(null)
  if (!ref.current) ref.current = new FormStore<DataOf<S>>(schema, options)
  const store = ref.current
  // Always call the latest callbacks without recreating the store.
  store.options = options
  useEffect(() => {
    store.setSchema(schema)
  }, [store, schema])
  return store
}

/** Re-renders on every change to the form. Prefer `useField` for a single field. */
export function useFormState(store: FormStore<any>): FormSnapshot {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
}

/** Subscribes to one field. The component re-renders only when that field changes. */
export function useField(path: string, store?: FormStore<any>): FieldSnapshot & {
  setValue: (value: unknown) => void
  onBlur: () => void
} {
  const ctx = useContext(FormContext)
  const s = store ?? ctx?.store
  if (!s) throw new Error('useField needs a store, or must be used inside <Form>')
  const get = () => s.getField(path)
  const snap = useSyncExternalStore(s.subscribe, get, get)
  return { ...snap, setValue: (value) => s.setValue(path, value), onBlur: () => s.touch(path) }
}

export { defaultLabels }

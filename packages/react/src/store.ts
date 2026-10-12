import {
  computeState,
  getInitialValues,
  type ComponentSchema,
  type ComputeOptions,
  type FieldState,
  type FormSchema,
  type FormState,
  type FormValues,
} from '@formknit/core'

export interface FormOptions<D = FormValues> {
  /** Values to start with, e.g. a saved draft. */
  defaultValues?: FormValues
  /** Called with the cleaned data once every rule passes. May return a promise. */
  onSubmit?: (data: D) => void | Promise<void>
  /** Called after every change with the raw values, e.g. to save a draft. */
  onChange?: (values: FormValues, state: FormState) => void
  /** Stores a chosen file and returns what to keep in the data, usually a URL or id. */
  onUpload?: (file: File) => unknown | Promise<unknown>
  /** Replacement messages, extra expression functions and a fixed clock. */
  compute?: ComputeOptions
}

export interface FieldSnapshot {
  path: string
  value: unknown
  /** Every current problem with the value. */
  errors: string[]
  /** The message to show now, once the user has touched the field or tried to continue. */
  error: string | undefined
  visible: boolean
  required: boolean
  disabled: boolean
  touched: boolean
}

export interface PageInfo {
  /** Index in `schema.pages`. */
  index: number
  key: string
  title: string | undefined
  valid: boolean
}

export interface FormSnapshot {
  values: FormValues
  state: FormState
  /** Pages that are currently shown, in order. */
  pages: PageInfo[]
  /** Position of the current page within `pages`. */
  step: number
  submitting: boolean
  submitted: boolean
}

type Listener = () => void
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

function getIn(obj: unknown, path: string[]): unknown {
  let cur = obj
  for (const seg of path) {
    if (Array.isArray(cur)) cur = cur[Number(seg)]
    else if (isObject(cur) && Object.prototype.hasOwnProperty.call(cur, seg)) cur = cur[seg]
    else return undefined
  }
  return cur
}

function setIn(obj: unknown, path: string[], value: unknown): unknown {
  if (!path.length) return value
  const [head, ...rest] = path
  if (Array.isArray(obj)) {
    const copy = obj.slice()
    copy[Number(head)] = setIn(copy[Number(head)], rest, value)
    return copy
  }
  const base = isObject(obj) ? obj : {}
  return { ...base, [head]: setIn(base[head], rest, value) }
}

function rowDefaults(list: ComponentSchema[] | undefined, out: Record<string, unknown> = {}) {
  for (const c of list ?? []) {
    if (c.type === 'repeater') {
      if (c.key) out[c.key] = []
      continue
    }
    if (c.key && c.defaultValue !== undefined) out[c.key] = c.defaultValue
    rowDefaults(c.components, out)
    for (const col of c.columns ?? []) rowDefaults(col.components, out)
  }
  return out
}

/**
 * Holds one form's values and everything derived from them. It has no React in it;
 * the hooks subscribe to it, and each field re-renders only when its own snapshot changes.
 */
export class FormStore<D = FormValues> {
  values: FormValues
  state: FormState
  options: FormOptions<D>
  /** Set by <Form>: moves keyboard focus to a field. */
  focusField: ((path: string) => void) | undefined

  private pageIndex = 0
  private submitting = false
  private submitted = false
  private touched = new Set<string>()
  private revealed = new Set<number>()
  private listeners = new Set<Listener>()
  private version = 0
  private fieldCache = new Map<string, { version: number; snap: FieldSnapshot }>()
  private snapshot!: FormSnapshot

  constructor(
    public schema: FormSchema,
    options: FormOptions<D> = {},
  ) {
    this.options = options
    this.values = getInitialValues(schema, options.defaultValues)
    this.state = computeState(schema, this.values, options.compute)
    this.refresh()
  }

  subscribe = (listener: Listener) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
  getSnapshot = (): FormSnapshot => this.snapshot

  private refresh() {
    const pages: PageInfo[] = []
    this.state.pages.forEach((p, index) => {
      if (p.visible) pages.push({ index, key: p.key, title: this.schema.pages[index]?.title, valid: p.valid })
    })
    // If the current page has just been hidden, fall back to the nearest earlier one.
    if (pages.length && !pages.some((p) => p.index === this.pageIndex)) {
      const earlier = pages.filter((p) => p.index < this.pageIndex)
      this.pageIndex = (earlier[earlier.length - 1] ?? pages[0]).index
    }
    this.snapshot = {
      values: this.values,
      state: this.state,
      pages,
      step: Math.max(0, pages.findIndex((p) => p.index === this.pageIndex)),
      submitting: this.submitting,
      submitted: this.submitted,
    }
    this.version++
  }

  private emit() {
    this.refresh()
    for (const listener of this.listeners) listener()
  }

  private recompute() {
    this.state = computeState(this.schema, this.values, this.options.compute)
    this.emit()
    this.options.onChange?.(this.values, this.state)
  }

  /** Replaces the schema, keeping the values that still apply. */
  setSchema(schema: FormSchema) {
    if (schema === this.schema) return
    this.schema = schema
    this.values = getInitialValues(schema, this.values)
    this.fieldCache.clear()
    this.recompute()
  }

  /** Starts again from the given values, or from the original defaults. */
  reset(values: FormValues | undefined = this.options.defaultValues) {
    this.values = getInitialValues(this.schema, values)
    this.touched.clear()
    this.revealed.clear()
    this.submitted = false
    this.pageIndex = 0
    this.recompute()
  }

  getValue(path: string): unknown {
    return getIn(this.values, path.split('.'))
  }

  setValue(path: string, value: unknown) {
    this.values = setIn(this.values, path.split('.'), value) as FormValues
    this.recompute()
  }

  /** Marks a field as visited so its error can be shown. */
  touch(path: string) {
    if (this.touched.has(path)) return
    this.touched.add(path)
    this.emit()
  }

  isVisible = (component: ComponentSchema, rowPath = '') => this.state.isVisible(component, rowPath)

  rowCount = (path: string): number => {
    const rows = this.getValue(path)
    return Array.isArray(rows) ? rows.length : 0
  }

  private editRows(path: string, edit: (rows: unknown[]) => void) {
    const current = this.getValue(path)
    const rows = Array.isArray(current) ? current.slice() : []
    edit(rows)
    // Row positions have changed, so "visited" marks under this list no longer line up.
    for (const t of [...this.touched]) if (t.startsWith(`${path}.`)) this.touched.delete(t)
    this.setValue(path, rows)
  }

  addRow(path: string, row?: Record<string, unknown>) {
    const component = this.state.fields[path]?.component
    this.editRows(path, (rows) => rows.push(row ?? rowDefaults(component?.components)))
  }
  removeRow(path: string, index: number) {
    this.editRows(path, (rows) => rows.splice(index, 1))
  }
  moveRow(path: string, from: number, to: number) {
    this.editRows(path, (rows) => {
      if (to < 0 || to >= rows.length) return
      rows.splice(to, 0, rows.splice(from, 1)[0])
    })
  }

  getField = (path: string): FieldSnapshot => {
    const cached = this.fieldCache.get(path)
    if (cached?.version === this.version) return cached.snap
    const fs: FieldState | undefined = this.state.fields[path]
    const raw = this.getValue(path)
    // Show what the user typed ("1.0"), not the normalised value (1). Formulas have no typed value.
    const value = fs?.type === 'calculated' || raw === undefined ? fs?.value : raw
    const errors = fs?.errors ?? []
    const touched = this.touched.has(path)
    const show = touched || this.submitted || (fs !== undefined && this.revealed.has(fs.page))
    const snap: FieldSnapshot = {
      path,
      value,
      errors,
      error: show ? errors[0] : undefined,
      visible: fs?.visible ?? false,
      required: fs?.required ?? false,
      disabled: fs?.disabled ?? false,
      touched,
    }
    const prev = cached?.snap
    const same =
      prev !== undefined &&
      prev.value === snap.value &&
      prev.error === snap.error &&
      prev.visible === snap.visible &&
      prev.required === snap.required &&
      prev.disabled === snap.disabled &&
      prev.touched === snap.touched &&
      prev.errors.join('\n') === errors.join('\n')
    const result = same ? prev : snap
    this.fieldCache.set(path, { version: this.version, snap: result })
    return result
  }

  private firstError(page?: number): string | undefined {
    return Object.keys(this.state.errors).find((path) => page === undefined || this.state.fields[path]?.page === page)
  }

  private goTo(pageIndex: number, focus?: string) {
    this.pageIndex = pageIndex
    this.emit()
    if (focus) this.focusField?.(focus)
  }

  /** Moves to the next page if the current one is valid. Returns whether it moved. */
  next(): boolean {
    const { pages, step } = this.snapshot
    const current = pages[step]
    if (!current) return false
    this.revealed.add(current.index)
    if (!current.valid) {
      this.goTo(current.index, this.firstError(current.index))
      return false
    }
    if (step >= pages.length - 1) return false
    this.goTo(pages[step + 1].index)
    return true
  }

  back() {
    const { pages, step } = this.snapshot
    if (step > 0) this.goTo(pages[step - 1].index)
  }

  /** Validates everything and calls `onSubmit` with the cleaned data. Returns whether it was valid. */
  async submit(): Promise<boolean> {
    if (this.submitting) return false
    this.submitted = true
    if (!this.state.valid) {
      const first = this.firstError()
      this.goTo(first ? (this.state.fields[first]?.page ?? this.pageIndex) : this.pageIndex, first)
      return false
    }
    this.submitting = true
    this.emit()
    try {
      await this.options.onSubmit?.(this.state.data as D)
    } finally {
      this.submitting = false
      this.emit()
    }
    return true
  }
}

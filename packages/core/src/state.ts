import { evaluateAst, isError, truthy, type Compiled, type ExprFunction } from './expr'
import { defaultMessages, type Messages } from './messages'
import { getModel, type Node, type Scope } from './model'
import type { ComponentSchema, FormSchema, FormValues, SchemaIssue } from './types'

export interface FieldState {
  /** Location in the data, e.g. `email` or `items.0.qty`. */
  path: string
  key: string
  /** Index of the page the field is on. */
  page: number
  type: string
  component: ComponentSchema
  visible: boolean
  required: boolean
  disabled: boolean
  value: unknown
  errors: string[]
}

export interface PageState {
  key: string
  visible: boolean
  valid: boolean
}

export interface FormState {
  /** Every value after normalising and calculating, including hidden fields. This is what a renderer shows. */
  values: FormValues
  /** What to submit: visible fields only, unknown keys removed, formulas recalculated. */
  data: FormValues
  fields: Record<string, FieldState>
  errors: Record<string, string[]>
  valid: boolean
  pages: PageState[]
  /** Whether a component is shown. Pass the row path (e.g. `items.0`) for components inside a repeater. */
  isVisible(component: ComponentSchema, rowPath?: string): boolean
  issues: SchemaIssue[]
}

export interface ComputeOptions {
  /** The current time, used by TODAY(). */
  now?: Date
  /** Extra expression functions. */
  functions?: Record<string, ExprFunction>
  /** Replacement error messages. */
  messages?: Partial<Messages>
}

interface Ctx {
  scope: Scope
  row: Record<string, unknown>
  /** '' for the form, `items.0` for a repeater row. */
  path: string
  parent: Ctx | null
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
/** Reads an own property only, so data can never reach `constructor` or `__proto__`. */
const own = (obj: Record<string, unknown>, key: string) =>
  Object.prototype.hasOwnProperty.call(obj, key) ? obj[key] : undefined
const join = (a: string, b: string) => (a ? `${a}.${b}` : b)
const emptyOf = (node: Node) => (node.def && 'emptyValue' in node.def ? node.def.emptyValue : '')
const blank = (v: unknown) => v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0)

function clone<T>(v: T): T {
  if (Array.isArray(v)) return v.map(clone) as T
  if (isObject(v)) {
    const out: Record<string, unknown> = {}
    for (const k of Object.keys(v)) if (k !== '__proto__') out[k] = clone(v[k])
    return out as T
  }
  return v
}

/**
 * Works out everything about a form for a given set of values: calculated fields,
 * which fields are visible, required or disabled, validation errors, and the data to submit.
 * It is a pure function, so the browser and the server always agree.
 */
export function computeState(schema: FormSchema, input: FormValues = {}, opts: ComputeOptions = {}): FormState {
  const model = getModel(schema)
  const messages: Messages = { ...defaultMessages, ...opts.messages }
  const evalOpts = { now: opts.now ?? new Date(), functions: opts.functions }
  const values = isObject(input) ? clone(input) : {}

  const hidden = new Set<string>()
  const pageHidden: boolean[] = []
  const calcErrors = new Map<string, string>()
  const hk = (rowPath: string, node: Node) => `${rowPath}|${node.id}`

  const rootCtx: Ctx = { scope: model.root, row: values, path: '', parent: null }
  const ctxCache = new Map<Scope, Ctx[]>()
  const contexts = (scope: Scope): Ctx[] => {
    let list = ctxCache.get(scope)
    if (list) return list
    if (!scope.repeater) list = [rootCtx]
    else {
      list = []
      const key = scope.repeater.c.key
      for (const pc of key ? contexts(scope.parent!) : []) {
        const rows = pc.row[key!]
        if (!Array.isArray(rows)) continue
        rows.forEach((row, i) => {
          if (isObject(row)) list!.push({ scope, row, path: join(pc.path, `${key}.${i}`), parent: pc })
        })
      }
    }
    ctxCache.set(scope, list)
    return list
  }

  // 1. Normalise raw values. Nodes are in document order, so a repeater is tidied before its rows are visited.
  for (const node of model.nodes) {
    const key = node.c.key
    if (!node.data || !key || node.scope.keys.get(key) !== node) continue
    for (const ctx of contexts(node.scope)) {
      const raw = own(ctx.row, key)
      if (node.kind === 'repeater') ctx.row[key] = Array.isArray(raw) ? raw.map((r) => (isObject(r) ? r : {})) : []
      else if (node.kind === 'calculated') ctx.row[key] = null
      else if (node.def?.coerce) ctx.row[key] = node.def.coerce(raw, node.c)
    }
  }

  // Reading a value from an expression. Hidden fields read as empty.
  const descend = (value: unknown, node: Node, path: string, rest: string[]): unknown => {
    if (!rest.length) return value === undefined ? null : value
    if (node.kind === 'repeater') {
      const rows = Array.isArray(value) ? (value as Record<string, unknown>[]) : []
      const [seg, ...more] = rest
      if (/^\d+$/.test(seg)) {
        const row = rows[Number(seg)]
        if (!row || !more.length) return row ?? null
        const child = node.childScope!.keys.get(more[0])
        if (!child || hidden.has(hk(`${path}.${seg}`, child))) return null
        return descend(own(row, more[0]), child, `${path}.${seg}.${more[0]}`, more.slice(1))
      }
      const child = node.childScope!.keys.get(seg)
      if (!child) return null
      const out: unknown[] = []
      rows.forEach((row, i) => {
        if (hidden.has(hk(`${path}.${i}`, child))) return
        const v = descend(own(row, seg), child, `${path}.${i}.${seg}`, more)
        if (Array.isArray(v) && child.kind === 'repeater') out.push(...v)
        else out.push(v)
      })
      return out
    }
    let cur = value
    for (const seg of rest) cur = isObject(cur) ? own(cur, seg) : null
    return cur === undefined ? null : cur
  }

  const read = (ctx: Ctx, path: string[]): unknown => {
    let c: Ctx | null = ctx
    while (c && !c.scope.keys.has(path[0])) c = c.parent
    if (!c) return null
    const node = c.scope.keys.get(path[0])!
    if (hidden.has(hk(c.path, node))) return null
    return descend(own(c.row, path[0]), node, join(c.path, path[0]), path.slice(1))
  }

  const run = (compiled: Compiled, ctx: Ctx, own?: unknown): unknown =>
    evaluateAst(compiled.ast, (path) => (path[0] === '$value' ? own : read(ctx, path)), evalOpts)

  // 2. Page visibility, field visibility and calculations, dependencies first.
  for (const item of model.order) {
    if (item.k === 'p') {
      const compiled = model.pageVisible[item.page]
      const result = compiled ? run(compiled, rootCtx) : true
      pageHidden[item.page] = !isError(result) && !truthy(result)
      continue
    }
    const node = item.node
    if (item.k === 'c' && (!node.c.key || node.scope.keys.get(node.c.key) !== node)) continue
    for (const ctx of contexts(node.scope)) {
      if (item.k === 'v') {
        let parentHidden: boolean
        if (!node.parent) parentHidden = pageHidden[node.pageIndex]
        else if (node.parent.scope === node.scope) parentHidden = hidden.has(hk(ctx.path, node.parent))
        else parentHidden = hidden.has(hk(ctx.parent!.path, node.parent))
        const result = !parentHidden && node.visible ? run(node.visible, ctx) : true
        // A broken visibility rule leaves the field visible, so the problem can be seen and fixed.
        if (parentHidden || (!isError(result) && !truthy(result))) hidden.add(hk(ctx.path, node))
      } else {
        const result = run(node.calc!, ctx)
        const path = join(ctx.path, node.c.key!)
        if (isError(result)) calcErrors.set(path, result.code)
        else if (Array.isArray(result) || isObject(result)) calcErrors.set(path, '#VALUE!')
        ctx.row[node.c.key!] = calcErrors.has(path) ? null : result
      }
    }
  }

  // 3. Per-field state, validation and the cleaned data.
  const fields: Record<string, FieldState> = {}
  const errors: Record<string, string[]> = {}
  const pages: PageState[] = (model.schema.pages ?? []).map((p, i) => ({ key: p.key, visible: !pageHidden[i], valid: true }))

  const validateValue = (node: Node, value: unknown, required: boolean, ctx: Ctx, path: string): string[] => {
    const c = node.c
    const v = c.validate ?? {}
    const label = c.label || c.key!
    if (node.kind === 'calculated' && calcErrors.has(path)) return [messages.calculation(label, calcErrors.get(path)!)]
    const empty = node.def?.isEmpty ? node.def.isEmpty(value) : blank(value)
    if (empty) {
      if (required) return [node.def?.requiredMessage?.(label, messages) ?? messages.required(label)]
      // "At least N items" applies to an empty list too; other limits wait until there is a value.
      if (Array.isArray(value) && v.minItems) return [messages.minItems(label, v.minItems)]
      return []
    }

    const typeError = node.def?.check?.(value, c, label, messages)
    if (typeError) return [typeError]

    const out: string[] = []
    if (typeof value === 'string') {
      if (v.minLength !== undefined && value.length < v.minLength) out.push(messages.minLength(label, v.minLength))
      if (v.maxLength !== undefined && value.length > v.maxLength) out.push(messages.maxLength(label, v.maxLength))
      if (v.pattern) {
        let re: RegExp | null = null
        try {
          re = new RegExp(`^(?:${v.pattern})$`)
        } catch {
          // An invalid pattern is a schema mistake, not the respondent's.
        }
        if (re && !re.test(value)) out.push(v.patternMessage || messages.pattern(label))
      }
    }
    if (typeof value === 'number' || (typeof value === 'string' && c.type === 'date')) {
      // Numbers compare with numbers and dates with dates; a mismatched limit is ignored.
      const below = (limit: number | string) => typeof limit === typeof value && (value as number) < (limit as number)
      const above = (limit: number | string) => typeof limit === typeof value && (value as number) > (limit as number)
      if (v.min !== undefined && below(v.min)) out.push(messages.min(label, v.min))
      if (v.max !== undefined && above(v.max)) out.push(messages.max(label, v.max))
    }
    if (Array.isArray(value)) {
      if (v.minItems !== undefined && value.length < v.minItems) out.push(messages.minItems(label, v.minItems))
      if (v.maxItems !== undefined && value.length > v.maxItems) out.push(messages.maxItems(label, v.maxItems))
    }
    for (const rule of node.rules) {
      const result = run(rule.compiled, ctx, value)
      if (isError(result) || !truthy(result)) out.push(rule.message)
    }
    return out
  }

  const build = (list: ComponentSchema[] | undefined, ctx: Ctx, out: Record<string, unknown>, pageIndex: number) => {
    for (const c of list ?? []) {
      const node = model.byComponent.get(c)
      if (!node) continue
      const key = c.key
      if (!node.data || !key || node.scope.keys.get(key) !== node) {
        if (node.kind !== 'repeater') {
          build(c.components, ctx, out, pageIndex)
          for (const col of c.columns ?? []) build(col?.components, ctx, out, pageIndex)
        }
        continue
      }
      const path = join(ctx.path, key)
      const visible = !hidden.has(hk(ctx.path, node))
      const value = own(ctx.row, key)
      const flag = (compiled: Compiled | undefined) => {
        if (!compiled) return false
        const result = run(compiled, ctx, value)
        return !isError(result) && truthy(result)
      }
      const required = !!c.validate?.required || flag(node.required)
      const disabled = node.kind === 'calculated' || flag(node.disabled)
      const checked = visible && (node.kind === 'calculated' || !disabled)
      const fieldErrors = checked ? validateValue(node, value, required, ctx, path) : []
      fields[path] = { path, key, page: pageIndex, type: c.type, component: c, visible, required, disabled, value, errors: fieldErrors }
      if (fieldErrors.length) {
        errors[path] = fieldErrors
        pages[pageIndex].valid = false
      }
      if (node.kind === 'repeater') {
        const rows: Record<string, unknown>[] = []
        for (const rowCtx of contexts(node.childScope!)) {
          if (rowCtx.parent !== ctx) continue
          const rowOut: Record<string, unknown> = {}
          build(c.components, rowCtx, rowOut, pageIndex)
          rows.push(rowOut)
        }
        if (visible) out[key] = rows
      } else if (visible) {
        const empty = node.def?.isEmpty ? node.def.isEmpty(value) : blank(value)
        out[key] = empty ? clone(emptyOf(node)) : value
      }
    }
  }

  const data: FormValues = {}
  ;(model.schema.pages ?? []).forEach((page, i) => build(page.components, rootCtx, data, i))

  return {
    values,
    data,
    fields,
    errors,
    valid: Object.keys(errors).length === 0,
    pages,
    isVisible(component, rowPath = '') {
      const node = model.byComponent.get(component)
      return !!node && !hidden.has(hk(rowPath, node))
    },
    issues: model.issues,
  }
}

/** Starting values for a form: each field's default, or its empty value. */
export function getInitialValues(schema: FormSchema, partial: FormValues = {}): FormValues {
  const model = getModel(schema)
  const fill = (list: ComponentSchema[] | undefined, source: Record<string, unknown>, out: Record<string, unknown>) => {
    for (const c of list ?? []) {
      const node = model.byComponent.get(c)
      if (!node) continue
      if (!node.data || !c.key) {
        fill(c.components, source, out)
        for (const col of c.columns ?? []) fill(col?.components, source, out)
        continue
      }
      if (node.kind === 'calculated') continue
      const given = own(source, c.key) !== undefined ? own(source, c.key) : c.defaultValue
      if (node.kind === 'repeater') {
        const rows = Array.isArray(given) ? given : []
        out[c.key] = rows.map((row) => {
          const rowOut: Record<string, unknown> = {}
          fill(c.components, isObject(row) ? row : {}, rowOut)
          return rowOut
        })
      } else {
        out[c.key] = clone(given !== undefined ? given : emptyOf(node))
      }
    }
  }
  const out: FormValues = {}
  for (const page of model.schema.pages ?? []) fill(page.components, isObject(partial) ? partial : {}, out)
  return out
}

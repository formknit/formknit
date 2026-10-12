import { getField, type ComponentSchema, type FormSchema } from '@formknit/core'

/**
 * Where a component sits: page index, then its index, then for each level of nesting
 * a slot ('k' for `components`, or a column number) and an index. `[0, 2, 'k', 1]` is
 * the second child of the third component on the first page.
 */
export type Path = (number | 'k')[]

export const pathKey = (path: Path): string => path.join('/')
export const parsePath = (key: string): Path => key.split('/').map((s) => (s === 'k' ? 'k' : Number(s)))

/** Schemas are plain JSON, so a JSON round trip is a safe deep copy. */
export const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))

/** The list a path points into. `[0]` is a page's components, `[0, 2, 'k']` a container's children. */
export function listAt(schema: FormSchema, listPath: Path): ComponentSchema[] | undefined {
  let list: ComponentSchema[] | undefined = schema.pages[listPath[0] as number]?.components
  for (let i = 1; i < listPath.length; i += 2) {
    const c: ComponentSchema | undefined = list?.[listPath[i] as number]
    const slot = listPath[i + 1]
    list = slot === 'k' ? c?.components : c?.columns?.[slot]?.components
  }
  return list
}

export function componentAt(schema: FormSchema, path: Path): ComponentSchema | undefined {
  return listAt(schema, path.slice(0, -1))?.[path[path.length - 1] as number]
}

/** Visits every component with its path. */
export function walk(schema: FormSchema, visit: (c: ComponentSchema, path: Path) => void): void {
  const each = (list: ComponentSchema[] | undefined, listPath: Path) => {
    ;(list ?? []).forEach((c, i) => {
      const path = [...listPath, i]
      visit(c, path)
      each(c.components, [...path, 'k'])
      ;(c.columns ?? []).forEach((col, n) => each(col.components, [...path, n]))
    })
  }
  schema.pages.forEach((page, p) => each(page.components, [p]))
}

export function findPath(schema: FormSchema, target: ComponentSchema): Path | null {
  let found: Path | null = null
  walk(schema, (c, path) => {
    if (c === target) found = path
  })
  return found
}

const RESERVED = new Set(['true', 'false', 'null', 'and', 'or', 'not', '__proto__', 'constructor', 'prototype'])
export const isValidKey = (key: string) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(key) && !RESERVED.has(key.toLowerCase())

/** "Full name" -> "fullName". Returns '' when nothing usable is left. */
export function toKey(label: string): string {
  const words = label.match(/[A-Za-z0-9]+/g) ?? []
  const key = words.map((w, i) => (i === 0 ? w.toLowerCase() : w[0].toUpperCase() + w.slice(1).toLowerCase())).join('')
  return key.replace(/^\d+/, '')
}

/** A key no other component uses. Keys are kept unique across the whole form, which is stricter than required. */
export function uniqueKey(schema: FormSchema, base: string, self?: ComponentSchema): string {
  const taken = new Set<string>()
  walk(schema, (c) => {
    if (c !== self && c.key) taken.add(c.key)
  })
  const stem = isValidKey(base) ? base : 'field'
  if (!taken.has(stem)) return stem
  for (let n = 2; ; n++) if (!taken.has(`${stem}${n}`)) return `${stem}${n}`
}

const QUOTED = /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/

/** Renames a field reference inside an expression, leaving quoted text and function names alone. */
export function renameRef(expression: string, from: string, to: string): string {
  const name = new RegExp(`(?<![\\w$])${from}(?![\\w$(])`, 'g')
  return expression
    .split(QUOTED)
    .map((part, i) => (i % 2 ? part : part.replace(name, to)))
    .join('')
}

const EXPRESSIONS = ['visibleWhen', 'requiredWhen', 'disabledWhen', 'expression'] as const

/** Changes a component's key and every expression in the form that refers to it. */
export function renameKey(schema: FormSchema, target: ComponentSchema, to: string): void {
  const from = target.key
  target.key = to
  if (!from || from === to) return
  const fix = (holder: Record<string, unknown>, prop: string) => {
    if (typeof holder[prop] === 'string') holder[prop] = renameRef(holder[prop] as string, from, to)
  }
  for (const page of schema.pages) fix(page as unknown as Record<string, unknown>, 'visibleWhen')
  walk(schema, (c) => {
    for (const prop of EXPRESSIONS) fix(c, prop)
    for (const rule of c.validate?.rules ?? []) fix(rule as unknown as Record<string, unknown>, 'expression')
  })
}

/** Whether a key still looks generated (from the type or the label), so it may follow the label. */
export function isAutoKey(c: ComponentSchema): boolean {
  if (!c.key) return true
  const stem = c.key.replace(/\d+$/, '')
  return stem === c.type || stem === 'field' || stem === toKey(c.label ?? '').replace(/\d+$/, '')
}

export const isData = (c: ComponentSchema) => {
  const kind = getField(c.type)?.kind
  return kind === 'input' || kind === 'calculated' || kind === 'repeater'
}

/** Reads `validate.min` style paths. */
export function getProp(obj: Record<string, unknown>, path: string): unknown {
  let cur: unknown = obj
  for (const seg of path.split('.')) cur = cur !== null && typeof cur === 'object' ? (cur as Record<string, unknown>)[seg] : undefined
  return cur
}

/** Writes `validate.min` style paths. Empty values are removed, along with objects left empty. */
export function setProp(obj: Record<string, unknown>, path: string, value: unknown): void {
  const segs = path.split('.')
  const empty = value === undefined || value === null || value === '' || value === false
  if (segs.length === 1) {
    if (empty) delete obj[segs[0]]
    else obj[segs[0]] = value
    return
  }
  const [head, ...rest] = segs
  const child = obj[head] !== null && typeof obj[head] === 'object' ? (obj[head] as Record<string, unknown>) : {}
  setProp(child, rest.join('.'), value)
  if (Object.keys(child).length) obj[head] = child
  else delete obj[head]
}

export interface ScopeField {
  key: string
  label: string
  type: string
}

/** Fields an expression on the given component can refer to by name: the form's own, plus its row's. */
export function fieldsInScope(schema: FormSchema, path: Path | null): ScopeField[] {
  const out: ScopeField[] = []
  const self = path ? componentAt(schema, path) : undefined
  const prefix = path ? pathKey(path) : ''
  walk(schema, (c, p) => {
    if (!c.key || !isData(c) || c === self) return
    // Find the repeaters this component is inside; it is in scope only if they also contain `path`.
    let inScope = true
    for (let i = 2; i < p.length; i += 2) {
      const ancestor = componentAt(schema, p.slice(0, i))
      if (ancestor?.type === 'repeater' && !prefix.startsWith(`${pathKey(p.slice(0, i))}/`)) inScope = false
    }
    if (inScope) out.push({ key: c.key, label: c.label || c.key, type: c.type })
  })
  return out
}

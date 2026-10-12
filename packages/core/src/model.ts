import { compile, ExprSyntaxError, type Compiled } from './expr'
import { getField, type FieldDefinition, type FieldKind } from './registry'
import type { ComponentSchema, FormSchema, SchemaIssue } from './types'

/** A place where field keys live: the form itself, or the rows of one repeater. */
export interface Scope {
  repeater: Node | null
  parent: Scope | null
  keys: Map<string, Node>
}

/** One component of the schema with everything pre-computed for evaluation. */
export interface Node {
  id: number
  c: ComponentSchema
  def: FieldDefinition | undefined
  kind: FieldKind | 'unknown'
  /** True when the component holds a value in the data. */
  data: boolean
  scope: Scope
  /** Enclosing panel, columns or repeater. Null at the top of a page. */
  parent: Node | null
  pageIndex: number
  /** Path with repeater rows left out, e.g. `items.amount`. */
  tpl: string
  /** The scope of this repeater's rows. */
  childScope?: Scope
  visible?: Compiled
  required?: Compiled
  disabled?: Compiled
  calc?: Compiled
  rules: { compiled: Compiled; message: string }[]
}

export type OrderItem = { k: 'p'; page: number } | { k: 'v'; node: Node } | { k: 'c'; node: Node }

export interface Model {
  schema: FormSchema
  nodes: Node[]
  byComponent: Map<ComponentSchema, Node>
  root: Scope
  pageVisible: (Compiled | undefined)[]
  /** Page visibility, field visibility and calculations, sorted so dependencies come first. */
  order: OrderItem[]
  issues: SchemaIssue[]
}

const KEY = /^[A-Za-z_][A-Za-z0-9_]*$/
const RESERVED = new Set(['true', 'false', 'null', 'and', 'or', 'not', '__proto__', 'constructor', 'prototype'])
const models = new WeakMap<FormSchema, Model>()

/** Finds the component a reference points at, looking outward from the given scope. */
export function resolveRef(scope: Scope, path: string[]): Node | null {
  let s: Scope | null = scope
  while (s && !s.keys.has(path[0])) s = s.parent
  if (!s) return null
  let node = s.keys.get(path[0])!
  for (let i = 1; i < path.length && node.kind === 'repeater'; i++) {
    if (/^\d+$/.test(path[i])) continue
    const child = node.childScope!.keys.get(path[i])
    if (!child) break
    node = child
  }
  return node
}

/**
 * Analyses a schema once: checks it, compiles its expressions and works out the order
 * in which visibility and calculations must run. Cached per schema object, so treat
 * schemas as immutable and create a new object when one changes.
 */
export function getModel(schema: FormSchema): Model {
  const cached = models.get(schema)
  if (cached) return cached

  const issues: SchemaIssue[] = []
  const nodes: Node[] = []
  const byComponent = new Map<ComponentSchema, Node>()
  const root: Scope = { repeater: null, parent: null, keys: new Map() }
  const error = (path: string, message: string) => issues.push({ level: 'error', path, message })
  const warn = (path: string, message: string) => issues.push({ level: 'warning', path, message })

  const expr = (source: unknown, path: string, what: string): Compiled | undefined => {
    if (source === undefined || source === null || source === '') return undefined
    if (typeof source !== 'string') {
      error(path, `${what} must be text`)
      return undefined
    }
    try {
      return compile(source)
    } catch (e) {
      if (!(e instanceof ExprSyntaxError)) throw e
      error(path, `${what}: ${e.message}`)
      return undefined
    }
  }

  const visit = (list: unknown, scope: Scope, parent: Node | null, pageIndex: number, prefix: string) => {
    if (list === undefined) return
    if (!Array.isArray(list)) {
      error(prefix || '(form)', 'components must be a list')
      return
    }
    for (const c of list as ComponentSchema[]) {
      if (!c || typeof c !== 'object' || typeof c.type !== 'string') {
        error(prefix || '(form)', 'Every component needs a type')
        continue
      }
      const def = getField(c.type)
      const kind = def?.kind ?? 'unknown'
      const data = kind === 'input' || kind === 'calculated' || kind === 'repeater'
      const id = nodes.length
      const tpl = prefix + (data && c.key ? c.key : `#${id}`)
      const node: Node = { id, c, def, kind, data, scope, parent, pageIndex, tpl, rules: [] }
      nodes.push(node)
      byComponent.set(c, node)

      if (!def) error(tpl, `Unknown field type "${c.type}"`)
      if (data) {
        if (!c.key) error(tpl, `A ${c.type} field needs a key`)
        else if (!KEY.test(c.key)) error(tpl, `Key "${c.key}" may only use letters, digits and _ and cannot start with a digit`)
        else if (RESERVED.has(c.key.toLowerCase())) error(tpl, `Key "${c.key}" is a reserved word`)
        else if (scope.keys.has(c.key)) error(tpl, `Key "${c.key}" is used more than once`)
        else scope.keys.set(c.key, node)
      }
      if (def?.usesOptions && !(Array.isArray(c.options) && c.options.length)) {
        warn(tpl, `${def.label} field has no options`)
      }

      node.visible = expr(c.visibleWhen, tpl, 'visibleWhen')
      node.required = expr(c.requiredWhen, tpl, 'requiredWhen')
      node.disabled = expr(c.disabledWhen, tpl, 'disabledWhen')
      if (kind === 'calculated') {
        node.calc = expr(c.expression, tpl, 'expression')
        if (!c.expression) error(tpl, 'A calculated field needs an expression')
      }
      for (const rule of c.validate?.rules ?? []) {
        const compiled = expr(rule.expression, tpl, 'Validation rule')
        if (compiled) node.rules.push({ compiled, message: rule.message })
      }

      if (kind === 'repeater') {
        node.childScope = { repeater: node, parent: scope, keys: new Map() }
        visit(c.components ?? [], node.childScope, node, pageIndex, `${tpl}.`)
      } else {
        visit(c.components, scope, node, pageIndex, prefix)
        for (const col of c.columns ?? []) visit(col?.components, scope, node, pageIndex, prefix)
      }
    }
  }

  const pages = Array.isArray(schema?.pages) ? schema.pages : []
  if (!Array.isArray(schema?.pages)) error('(form)', 'A form needs a list of pages')
  if (schema?.version !== 1) warn('(form)', 'Schema version should be 1')
  const pageKeys = new Set<string>()
  const pageVisible = pages.map((page, i) => {
    if (!page.key) error(`(page ${i + 1})`, 'A page needs a key')
    else if (pageKeys.has(page.key)) error(page.key, `Page key "${page.key}" is used more than once`)
    pageKeys.add(page.key)
    visit(page.components ?? [], root, null, i, '')
    return expr(page.visibleWhen, page.key ?? `(page ${i + 1})`, 'visibleWhen')
  })

  // Dependency graph. "v" = is this component visible, "c" = this calculated value, "p" = page visible.
  // Reading a field depends on its visibility because hidden fields read as empty.
  const depsOf = (refs: string[][], scope: Scope, where: string): string[] => {
    const out: string[] = []
    for (const path of refs) {
      if (path[0] === '$value') continue
      const target = resolveRef(scope, path)
      if (!target) {
        warn(where, `Unknown field "${path.join('.')}"`)
        continue
      }
      out.push(`v${target.id}`)
      if (target.kind === 'calculated') out.push(`c${target.id}`)
    }
    return out
  }

  const items = new Map<string, { item: OrderItem; deps: string[]; label: string }>()
  pages.forEach((page, i) => {
    items.set(`p${i}`, {
      item: { k: 'p', page: i },
      deps: depsOf(pageVisible[i]?.refs ?? [], root, page.key),
      label: `page ${page.key}`,
    })
  })
  for (const node of nodes) {
    items.set(`v${node.id}`, {
      item: { k: 'v', node },
      deps: [node.parent ? `v${node.parent.id}` : `p${node.pageIndex}`, ...depsOf(node.visible?.refs ?? [], node.scope, node.tpl)],
      label: node.tpl,
    })
    if (node.calc) {
      items.set(`c${node.id}`, { item: { k: 'c', node }, deps: depsOf(node.calc.refs, node.scope, node.tpl), label: node.tpl })
    }
    for (const rule of node.rules) depsOf(rule.compiled.refs, node.scope, node.tpl)
    if (node.required) depsOf(node.required.refs, node.scope, node.tpl)
    if (node.disabled) depsOf(node.disabled.refs, node.scope, node.tpl)
  }

  const order: OrderItem[] = []
  const state = new Map<string, 1 | 2>()
  const trail: string[] = []
  const walk = (id: string) => {
    const entry = items.get(id)
    if (!entry || state.get(id) === 2) return
    if (state.get(id) === 1) {
      const loop = [...trail.slice(trail.indexOf(id)), id].map((x) => items.get(x)!.label)
      const names = loop.filter((name, i) => name !== loop[i - 1])
      if (names.length === 1) names.push(names[0])
      error(entry.label, `Circular reference: ${names.join(' → ')}`)
      return
    }
    state.set(id, 1)
    trail.push(id)
    for (const dep of entry.deps) walk(dep)
    trail.pop()
    state.set(id, 2)
    order.push(entry.item)
  }
  for (const id of items.keys()) walk(id)

  const model: Model = { schema, nodes, byComponent, root, pageVisible, order, issues }
  if (schema && typeof schema === 'object') models.set(schema, model)
  return model
}

/** Lists problems in a schema. Errors make a form unusable; warnings are probably mistakes. */
export function checkSchema(schema: FormSchema): SchemaIssue[] {
  return getModel(schema).issues
}

import { compile, type Ast } from '@formknit/core'

export type Operator =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'contains'
  | 'empty'
  | 'notEmpty'
  | 'checked'
  | 'unchecked'

export interface Rule {
  field: string
  op: Operator
  value: string
}

export interface RuleSet {
  /** `all`: every rule must hold. `any`: one is enough. */
  mode: 'all' | 'any'
  rules: Rule[]
}

export const OPERATORS: { op: Operator; label: string; needsValue: boolean }[] = [
  { op: 'eq', label: 'is', needsValue: true },
  { op: 'neq', label: 'is not', needsValue: true },
  { op: 'gt', label: 'is more than', needsValue: true },
  { op: 'gte', label: 'is at least', needsValue: true },
  { op: 'lt', label: 'is less than', needsValue: true },
  { op: 'lte', label: 'is at most', needsValue: true },
  { op: 'contains', label: 'contains', needsValue: true },
  { op: 'empty', label: 'is empty', needsValue: false },
  { op: 'notEmpty', label: 'is not empty', needsValue: false },
  { op: 'checked', label: 'is ticked', needsValue: false },
  { op: 'unchecked', label: 'is not ticked', needsValue: false },
]

const SYMBOL: Partial<Record<Operator, string>> = { eq: '==', neq: '!=', gt: '>', gte: '>=', lt: '<', lte: '<=' }
const FROM_SYMBOL: Record<string, Operator> = { '==': 'eq', '!=': 'neq', '>': 'gt', '>=': 'gte', '<': 'lt', '<=': 'lte' }
const NUMERIC = /^-?\d+(\.\d+)?$/

const quote = (text: string) => `"${text.replace(/[\\"]/g, '\\$&')}"`

/** Turns rules into an expression. `isNumeric` says which fields hold numbers, so their values are not quoted. */
export function toExpression(set: RuleSet, isNumeric: (field: string) => boolean = () => false): string {
  const parts = set.rules
    .filter((r) => r.field)
    .map((r) => {
      const literal = isNumeric(r.field) && NUMERIC.test(r.value.trim()) ? r.value.trim() : quote(r.value)
      switch (r.op) {
        case 'contains':
          return `CONTAINS(${r.field}, ${quote(r.value)})`
        case 'empty':
          return `ISEMPTY(${r.field})`
        case 'notEmpty':
          return `NOT ISEMPTY(${r.field})`
        case 'checked':
          return `${r.field} == true`
        case 'unchecked':
          return `${r.field} != true`
        default:
          return `${r.field} ${SYMBOL[r.op]} ${literal}`
      }
    })
  return parts.join(set.mode === 'all' ? ' AND ' : ' OR ')
}

function leaf(ast: Ast): Rule | null {
  if (ast.t === 'bin' && FROM_SYMBOL[ast.op] && ast.l.t === 'ref' && ast.r.t === 'lit') {
    const field = ast.l.path.join('.')
    if (ast.r.v === true && ast.op === '==') return { field, op: 'checked', value: '' }
    if (ast.r.v === true && ast.op === '!=') return { field, op: 'unchecked', value: '' }
    if (typeof ast.r.v === 'boolean' || ast.r.v === null) return null
    return { field, op: FROM_SYMBOL[ast.op], value: String(ast.r.v) }
  }
  const call = (node: Ast, name: string, args: number) =>
    node.t === 'call' && node.name === name && node.args.length === args && node.args[0].t === 'ref' ? node : null
  const contains = call(ast, 'CONTAINS', 2)
  if (contains && contains.args[1].t === 'lit' && typeof contains.args[1].v === 'string') {
    return { field: (contains.args[0] as Extract<Ast, { t: 'ref' }>).path.join('.'), op: 'contains', value: contains.args[1].v }
  }
  const isEmpty = call(ast, 'ISEMPTY', 1)
  if (isEmpty) return { field: (isEmpty.args[0] as Extract<Ast, { t: 'ref' }>).path.join('.'), op: 'empty', value: '' }
  if (ast.t === 'un' && ast.op === 'NOT') {
    const inner = call(ast.arg, 'ISEMPTY', 1)
    if (inner) return { field: (inner.args[0] as Extract<Ast, { t: 'ref' }>).path.join('.'), op: 'notEmpty', value: '' }
  }
  return null
}

/**
 * Reads an expression back as rules. Returns null when it is something the rule editor
 * cannot show, such as a mix of AND and OR or a formula; the raw expression is edited then.
 */
export function fromExpression(source: string | undefined): RuleSet | null {
  if (!source || !source.trim()) return { mode: 'all', rules: [] }
  let ast: Ast
  try {
    ast = compile(source).ast
  } catch {
    return null
  }
  const joiner = ast.t === 'bin' && (ast.op === 'AND' || ast.op === 'OR') ? ast.op : null
  const leaves: Ast[] = []
  const flatten = (node: Ast) => {
    if (joiner && node.t === 'bin' && node.op === joiner) {
      flatten(node.l)
      flatten(node.r)
    } else leaves.push(node)
  }
  flatten(ast)
  const rules = leaves.map(leaf)
  if (rules.some((r) => r === null)) return null
  return { mode: joiner === 'OR' ? 'any' : 'all', rules: rules as Rule[] }
}

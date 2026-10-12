import type { Ast } from './parse'

/** A failed calculation. Errors are values: they flow through an expression instead of throwing. */
export class ExprError {
  constructor(
    public code: string,
    public message: string,
  ) {}
}

export type ExprFunction = (args: unknown[], env: EvalEnv) => unknown

export interface EvalOptions {
  /** The current time, used by TODAY(). Pass a fixed date for repeatable results. */
  now?: Date
  /** Extra functions for this call, on top of the built-ins and registered ones. */
  functions?: Record<string, ExprFunction>
  maxSteps?: number
}

export interface EvalEnv {
  resolve: (path: string[]) => unknown
  now: Date
  functions?: Record<string, ExprFunction>
  steps: number
  maxSteps: number
}

export const isError = (v: unknown): v is ExprError => v instanceof ExprError
export const isEmpty = (v: unknown): boolean =>
  v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0)

export function truthy(v: unknown): boolean {
  if (typeof v === 'boolean') return v
  if (typeof v === 'number') return v !== 0
  if (typeof v === 'string') return v !== ''
  if (Array.isArray(v)) return v.length > 0
  return v !== null && v !== undefined && !isError(v)
}

const NUMERIC = /^-?\d+(\.\d+)?$/

export function toNumber(v: unknown): number | ExprError {
  if (typeof v === 'number') return Number.isFinite(v) ? v : new ExprError('#NUM!', 'Not a finite number')
  if (v === null || v === undefined || v === '') return 0
  if (typeof v === 'boolean') return v ? 1 : 0
  if (typeof v === 'string' && NUMERIC.test(v.trim())) return Number(v)
  if (isError(v)) return v
  return new ExprError('#VALUE!', `${describe(v)} is not a number`)
}

export function toText(v: unknown): string {
  if (v === null || v === undefined) return ''
  if (Array.isArray(v)) return v.map(toText).join(', ')
  return String(v)
}

const describe = (v: unknown) => (typeof v === 'string' ? `"${v}"` : Array.isArray(v) ? 'A list' : String(v))

/** Removes binary floating point noise such as 0.1 + 0.2 = 0.30000000000000004. */
const tidy = (n: number): number | ExprError =>
  Number.isFinite(n) ? Number(n.toPrecision(15)) : new ExprError('#NUM!', 'Result is not a finite number')

function arithmetic(op: string, l: unknown, r: unknown): unknown {
  const a = toNumber(l)
  if (isError(a)) return a
  const b = toNumber(r)
  if (isError(b)) return b
  switch (op) {
    case '+':
      return tidy(a + b)
    case '-':
      return tidy(a - b)
    case '*':
      return tidy(a * b)
    case '/':
      return b === 0 ? new ExprError('#DIV/0!', 'Division by zero') : tidy(a / b)
    case '%':
      return b === 0 ? new ExprError('#DIV/0!', 'Division by zero') : tidy(a % b)
    default:
      return tidy(Math.pow(a, b))
  }
}

const numeric = (v: unknown) => typeof v === 'number' || (typeof v === 'string' && NUMERIC.test(v.trim()))

function compare(op: string, l: unknown, r: unknown): unknown {
  if (Array.isArray(l) || Array.isArray(r)) {
    return new ExprError('#VALUE!', 'A list cannot be compared directly; use CONTAINS, COUNT or SUM')
  }
  const equality = op === '==' || op === '!='
  const le = isEmpty(l)
  const re = isEmpty(r)
  let order: number
  if (le && re) order = 0
  else if (equality && (le || re)) order = 1
  else if ((typeof l === 'number' || typeof r === 'number') && (numeric(l) || le) && (numeric(r) || re)) {
    order = Math.sign(Number(le ? 0 : l) - Number(re ? 0 : r))
  } else if (typeof l === 'boolean' && typeof r === 'boolean') order = Number(l) - Number(r)
  else if ((typeof l === 'string' || le) && (typeof r === 'string' || re)) {
    const a = le ? '' : (l as string)
    const b = re ? '' : (r as string)
    order = a < b ? -1 : a > b ? 1 : 0
  } else if (equality) order = 1
  else return new ExprError('#VALUE!', `${describe(l)} and ${describe(r)} cannot be ordered`)
  switch (op) {
    case '==':
      return order === 0
    case '!=':
      return order !== 0
    case '>':
      return order > 0
    case '>=':
      return order >= 0
    case '<':
      return order < 0
    default:
      return order <= 0
  }
}

const flatten = (args: unknown[]): unknown[] => (args as unknown[][]).flat(Infinity)

function numbers(args: unknown[]): number[] | ExprError {
  const out: number[] = []
  for (const v of flatten(args)) {
    if (isEmpty(v)) continue
    const n = toNumber(v)
    if (isError(n)) return n
    out.push(n)
  }
  return out
}

const aggregate =
  (fn: (ns: number[]) => unknown): ExprFunction =>
  (args) => {
    const ns = numbers(args)
    return isError(ns) ? ns : fn(ns)
  }

const one =
  (fn: (n: number, args: unknown[]) => unknown): ExprFunction =>
  (args) => {
    const n = toNumber(args[0])
    return isError(n) ? n : fn(n, args)
  }

const pad = (n: number) => String(n).padStart(2, '0')
const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

function parseDate(v: unknown): { y: number; m: number; d: number } | null | ExprError {
  if (isEmpty(v)) return null
  const m = typeof v === 'string' ? /^(\d{4})-(\d{2})-(\d{2})/.exec(v) : null
  if (!m) return new ExprError('#VALUE!', `${describe(v)} is not a date (expected YYYY-MM-DD)`)
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const check = new Date(Date.UTC(y, mo - 1, d))
  if (check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) {
    return new ExprError('#VALUE!', `${describe(v)} is not a real date`)
  }
  return { y, m: mo, d }
}

const datePart =
  (pick: (d: { y: number; m: number; d: number }) => number): ExprFunction =>
  (args) => {
    const d = parseDate(args[0])
    return d === null || isError(d) ? d : pick(d)
  }

const round = (n: number, digits: number) => {
  const f = Math.pow(10, digits)
  return tidy(Math.round((n + Number.EPSILON * Math.sign(n)) * f) / f)
}

export const builtins: Record<string, ExprFunction> = {
  SUM: aggregate((ns) => tidy(ns.reduce((a, b) => a + b, 0))),
  AVG: aggregate((ns) => (ns.length ? tidy(ns.reduce((a, b) => a + b, 0) / ns.length) : null)),
  MIN: aggregate((ns) => (ns.length ? Math.min(...ns) : null)),
  MAX: aggregate((ns) => (ns.length ? Math.max(...ns) : null)),
  COUNT: (args) => flatten(args).filter((v) => !isEmpty(v)).length,
  ROUND: one((n, args) => {
    const d = toNumber(args[1])
    return isError(d) ? d : round(n, d)
  }),
  FLOOR: one((n) => Math.floor(n)),
  CEIL: one((n) => Math.ceil(n)),
  ABS: one((n) => Math.abs(n)),
  NUMBER: one((n) => n),
  CONCAT: (args) => flatten(args).map(toText).join(''),
  LEN: (args) => toText(args[0]).length,
  UPPER: (args) => toText(args[0]).toUpperCase(),
  LOWER: (args) => toText(args[0]).toLowerCase(),
  TRIM: (args) => toText(args[0]).trim(),
  CONTAINS: (args) => {
    const [haystack, needle] = args
    if (Array.isArray(haystack)) return haystack.some((v) => toText(v) === toText(needle))
    return toText(haystack).toLowerCase().includes(toText(needle).toLowerCase())
  },
  ISEMPTY: (args) => isEmpty(args[0]),
  COALESCE: (args) => flatten(args).find((v) => !isEmpty(v)) ?? null,
  TODAY: (_args, env) => isoDate(env.now),
  YEAR: datePart((d) => d.y),
  MONTH: datePart((d) => d.m),
  DAY: datePart((d) => d.d),
  DATEDIF: (args) => {
    const a = parseDate(args[0])
    if (isError(a)) return a
    const b = parseDate(args[1])
    if (isError(b)) return b
    if (a === null || b === null) return null
    const unit = toText(args[2] ?? 'D').toUpperCase()
    if (unit === 'D') return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86400000)
    const months = (b.y - a.y) * 12 + (b.m - a.m) - (b.d < a.d ? 1 : 0)
    if (unit === 'M') return months
    if (unit === 'Y') return Math.trunc(months / 12)
    return new ExprError('#VALUE!', 'DATEDIF unit must be "D", "M" or "Y"')
  },
}

const registered: Record<string, ExprFunction> = {}

/** Adds a function usable in every expression. Names are case-insensitive. */
export function registerFunction(name: string, fn: ExprFunction): void {
  registered[name.toUpperCase()] = fn
}

/** Names of every function available to expressions, for editors and autocomplete. */
export function functionNames(): string[] {
  return [...new Set([...Object.keys(builtins), 'IF', 'IFERROR', 'AND', 'OR', 'NOT', ...Object.keys(registered)])].sort()
}

function run(ast: Ast, env: EvalEnv): unknown {
  if (++env.steps > env.maxSteps) return new ExprError('#LIMIT!', 'Expression takes too many steps')
  switch (ast.t) {
    case 'lit':
      return ast.v
    case 'ref': {
      const v = env.resolve(ast.path)
      return v === undefined ? null : v
    }
    case 'un': {
      const v = run(ast.arg, env)
      if (isError(v)) return v
      if (ast.op === 'NOT') return !truthy(v)
      const n = toNumber(v)
      return isError(n) ? n : -n
    }
    case 'bin': {
      const l = run(ast.l, env)
      if (isError(l)) return l
      if (ast.op === 'AND' && !truthy(l)) return false
      if (ast.op === 'OR' && truthy(l)) return true
      const r = run(ast.r, env)
      if (isError(r)) return r
      if (ast.op === 'AND' || ast.op === 'OR') return truthy(r)
      if (ast.op === '&') return toText(l) + toText(r)
      if (ast.op === '+' || ast.op === '-' || ast.op === '*' || ast.op === '/' || ast.op === '%' || ast.op === '^') {
        return arithmetic(ast.op, l, r)
      }
      return compare(ast.op, l, r)
    }
    case 'call':
      return call(ast, env)
  }
}

function call(ast: Extract<Ast, { t: 'call' }>, env: EvalEnv): unknown {
  const { name, args } = ast
  // These decide which arguments to evaluate, so they cannot be ordinary functions.
  if (name === 'IF') {
    const cond = run(args[0] ?? { t: 'lit', v: null }, env)
    if (isError(cond)) return cond
    const branch = truthy(cond) ? args[1] : args[2]
    return branch ? run(branch, env) : null
  }
  if (name === 'IFERROR') {
    const v = run(args[0] ?? { t: 'lit', v: null }, env)
    return isError(v) ? (args[1] ? run(args[1], env) : null) : v
  }
  if (name === 'AND' || name === 'OR') {
    for (const a of args) {
      const v = run(a, env)
      if (isError(v)) return v
      if (truthy(v) === (name === 'OR')) return name === 'OR'
    }
    return name === 'AND'
  }
  if (name === 'NOT') {
    const v = run(args[0] ?? { t: 'lit', v: null }, env)
    return isError(v) ? v : !truthy(v)
  }
  const fn = env.functions?.[name] ?? registered[name] ?? builtins[name]
  if (!fn) return new ExprError('#NAME?', `Unknown function ${name}`)
  const values: unknown[] = []
  for (const a of args) {
    const v = run(a, env)
    if (isError(v)) return v
    values.push(v)
  }
  try {
    const result = fn(values, env)
    return result === undefined ? null : result
  } catch (e) {
    return new ExprError('#ERROR!', e instanceof Error ? e.message : String(e))
  }
}

export function evaluateAst(ast: Ast, resolve: (path: string[]) => unknown, opts: EvalOptions = {}): unknown {
  const env: EvalEnv = {
    resolve,
    now: opts.now ?? new Date(),
    functions: opts.functions,
    steps: 0,
    maxSteps: opts.maxSteps ?? 10000,
  }
  return run(ast, env)
}

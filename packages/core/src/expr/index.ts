import { evaluateAst, type EvalOptions } from './evaluate'
import { parse, references, ExprSyntaxError, type Ast } from './parse'

export { ExprSyntaxError, parse, references, MAX_LENGTH, MAX_DEPTH } from './parse'
export type { Ast } from './parse'
export {
  ExprError,
  evaluateAst,
  registerFunction,
  functionNames,
  isError,
  isEmpty,
  truthy,
  toNumber,
  toText,
} from './evaluate'
export type { ExprFunction, EvalOptions, EvalEnv } from './evaluate'

export interface Compiled {
  source: string
  ast: Ast
  /** Field paths the expression reads. */
  refs: string[][]
}

const cache = new Map<string, Compiled | ExprSyntaxError>()

/** Parses an expression once and remembers the result. Throws ExprSyntaxError if it is malformed. */
export function compile(source: string): Compiled {
  let hit = cache.get(source)
  if (!hit) {
    try {
      const ast = parse(source)
      hit = { source, ast, refs: references(ast) }
    } catch (e) {
      if (!(e instanceof ExprSyntaxError)) throw e
      hit = e
    }
    if (cache.size > 5000) cache.clear()
    cache.set(source, hit)
  }
  if (hit instanceof ExprSyntaxError) throw hit
  return hit
}

/**
 * Reads a path from plain data. When a path crosses a list, it maps over the list,
 * so `items.amount` on `{ items: [{ amount: 1 }, { amount: 2 }] }` gives `[1, 2]`.
 */
export function readPath(data: unknown, path: string[]): unknown {
  let cur: unknown = data
  for (let i = 0; i < path.length; i++) {
    if (cur === null || cur === undefined) return null
    const seg = path[i]
    if (Array.isArray(cur) && !/^\d+$/.test(seg)) {
      const rest = path.slice(i)
      return cur.flatMap((row) => {
        const v = readPath(row, rest)
        return Array.isArray(v) ? v : [v]
      })
    }
    // Own properties only, so an expression can never reach `constructor` or `__proto__`.
    if (typeof cur !== 'object' || !Object.prototype.hasOwnProperty.call(cur, seg)) return null
    cur = (cur as Record<string, unknown>)[seg]
  }
  return cur === undefined ? null : cur
}

/** Evaluates an expression against plain data or a custom resolver. Never throws for bad data. */
export function evaluate(
  expression: string | Compiled,
  scope: Record<string, unknown> | ((path: string[]) => unknown) = {},
  opts: EvalOptions = {},
): unknown {
  const compiled = typeof expression === 'string' ? compile(expression) : expression
  const resolve = typeof scope === 'function' ? scope : (path: string[]) => readPath(scope, path)
  return evaluateAst(compiled.ast, resolve, opts)
}

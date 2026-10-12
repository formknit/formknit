import { computeState, type ComputeOptions } from './state'
import type { FormSchema, FormValues, LookupQuery, SchemaIssue } from './types'

export class SchemaError extends Error {
  constructor(public issues: SchemaIssue[]) {
    super(`Invalid form schema: ${issues.map((i) => `${i.path}: ${i.message}`).join('; ')}`)
    this.name = 'SchemaError'
  }
}

export interface ValidationResult {
  valid: boolean
  /** Error messages keyed by field path, e.g. `email` or `items.0.qty`. */
  errors: Record<string, string[]>
  /** Safe to store when `valid` is true: unknown and hidden fields removed, formulas recalculated. */
  data: FormValues
}

/**
 * Checks a submission against a schema. Run this on the server for every submission:
 * it ignores calculated values sent by the client and works them out again.
 * Throws SchemaError if the schema itself is broken.
 */
export function validate(schema: FormSchema, input: FormValues, opts: ComputeOptions = {}): ValidationResult {
  const state = computeState(schema, input, opts)
  const broken = state.issues.filter((i) => i.level === 'error')
  if (broken.length) throw new SchemaError(broken)
  return { valid: state.valid, errors: state.errors, data: state.data }
}

/** Fetches the value for a lookup field. Return null or undefined when nothing matches. */
export type LookupResolver = (query: LookupQuery) => unknown | Promise<unknown>

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

function setAt(obj: unknown, path: string[], value: unknown): unknown {
  if (!path.length) return value
  const [head, ...rest] = path
  if (Array.isArray(obj)) {
    const copy = obj.slice()
    copy[Number(head)] = setAt(copy[Number(head)], rest, value)
    return copy
  }
  const base = typeof obj === 'object' && obj !== null ? (obj as Record<string, unknown>) : {}
  return { ...base, [head]: setAt(Object.prototype.hasOwnProperty.call(base, head) ? base[head] : undefined, rest, value) }
}

/**
 * Fills in every lookup field by calling `lookup`, replacing whatever the client sent.
 * A lookup may feed another, so it repeats until the values settle (at most four passes).
 */
export async function resolveLookups(
  schema: FormSchema,
  input: FormValues,
  lookup: LookupResolver,
  opts: ComputeOptions = {},
): Promise<FormValues> {
  let values: FormValues = typeof input === 'object' && input !== null ? input : {}
  for (let pass = 0; pass < 4; pass++) {
    const state = computeState(schema, values, opts)
    let changed = false
    for (const field of Object.values(state.fields)) {
      if (field.lookup === undefined) continue
      const result = field.lookup === null ? null : ((await lookup(field.lookup)) ?? null)
      if (same(result, field.value)) continue
      values = setAt(values, field.path.split('.'), result) as FormValues
      changed = true
    }
    if (!changed) break
  }
  return values
}

/**
 * Like `validate`, for forms with lookup fields: it fetches their values on the server first,
 * so a client cannot make them up.
 */
export async function validateAsync(
  schema: FormSchema,
  input: FormValues,
  opts: ComputeOptions & { lookup: LookupResolver },
): Promise<ValidationResult> {
  const { lookup, ...rest } = opts
  return validate(schema, await resolveLookups(schema, input, lookup, rest), rest)
}

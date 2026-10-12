import { computeState, type ComputeOptions } from './state'
import type { FormSchema, FormValues, SchemaIssue } from './types'

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

import type { ComponentSchema, FormSchema, LookupQuery, LookupResolver } from '@formknit/core'
import { and, asc, eq } from 'drizzle-orm'
import { first, forms, submissions, type Db } from './db'

/** Every lookup field in a schema, wherever it is nested. */
export function lookupFields(schema: FormSchema): ComponentSchema[] {
  const out: ComponentSchema[] = []
  const visit = (list: ComponentSchema[] | undefined) => {
    for (const c of list ?? []) {
      if (c.type === 'lookup') out.push(c)
      visit(c.components)
      for (const col of c.columns ?? []) visit(col.components)
    }
  }
  for (const page of schema.pages ?? []) visit(page.components)
  return out
}

/**
 * Whether a schema really contains a lookup field asking this question. The public lookup
 * endpoint only answers queries the form itself defines, so it cannot be used to read
 * arbitrary data.
 */
export function schemaAllows(schema: FormSchema, query: LookupQuery): boolean {
  const fields = Object.keys(query.where)
  if (fields.length !== 1) return false
  return lookupFields(schema).some(
    (c) =>
      c.source === query.source &&
      c.matchField === fields[0] &&
      (c.returnField ?? undefined) === (query.select ?? undefined) &&
      (c.aggregate ?? 'first') === query.aggregate,
  )
}

const text = (v: unknown) => (v === null || v === undefined ? '' : String(v))

/**
 * Answers lookups from another form's submissions. A source is a form's slug, and it must
 * belong to the same workspace. Only fields the source form has marked as exposed can be matched
 * on or returned.
 */
export function makeLookup(db: Db, workspaceId: string): LookupResolver {
  return async (query) => {
    const [[field, value] = []] = Object.entries(query.where)
    if (!field) return null
    const source = await first(db.select().from(forms).where(and(eq(forms.workspaceId, workspaceId), eq(forms.slug, query.source))))
    if (!source) return null
    const exposed = new Set(source.settings.exposedFields ?? [])
    if (!exposed.has(field) || (query.select && !exposed.has(query.select))) return null

    // Matching is done here, not in SQL, so it behaves the same on every database. Fine for
    // thousands of rows; a large source will want an indexed column for the matched field.
    const rows = await db.select({ data: submissions.data }).from(submissions).where(eq(submissions.formId, source.id)).orderBy(asc(submissions.createdAt))
    const matches = rows.filter((row) => text(row.data[field]) === text(value))
    const values = query.select ? matches.map((row) => row.data[query.select!]) : matches.map(() => 1)
    const numbers = values.map(Number).filter((n) => Number.isFinite(n))
    switch (query.aggregate) {
      case 'count':
        return matches.length
      case 'sum':
        return numbers.reduce((a, b) => a + b, 0)
      case 'avg':
        return numbers.length ? numbers.reduce((a, b) => a + b, 0) / numbers.length : null
      case 'list':
        return values
      case 'last':
        return values.length ? (values[values.length - 1] ?? null) : null
      default:
        return values.length ? (values[0] ?? null) : null
    }
  }
}

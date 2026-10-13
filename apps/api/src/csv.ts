import { getField, htmlToText, type ComponentSchema, type FormSchema } from '@formknit/core'

/** Top-level data fields of a schema, in form order, with their labels. */
export interface Column {
  key: string
  label: string
  /** The field type, when the column comes from a field. */
  type?: string
}

/** A stored answer as plain text, for places that cannot show formatting. */
export const plain = (column: Column, value: unknown): unknown => (column.type === 'richText' && typeof value === 'string' ? htmlToText(value) : value)

export function columnsOf(schema: FormSchema): Column[] {
  const out: Column[] = []
  const visit = (list: ComponentSchema[] | undefined) => {
    for (const c of list ?? []) {
      const kind = getField(c.type)?.kind
      if (c.key && (kind === 'input' || kind === 'calculated' || kind === 'repeater')) {
        if (!out.some((col) => col.key === c.key)) out.push({ key: c.key, label: c.label || c.key, type: c.type })
        continue
      }
      visit(c.components)
      for (const col of c.columns ?? []) visit(col.components)
    }
  }
  for (const page of schema.pages ?? []) visit(page.components)
  return out
}

function cell(value: unknown): string {
  let text = value === null || value === undefined ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value)
  // Spreadsheets run cells starting with these as formulas. A leading apostrophe makes them plain text.
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function toCsv(columns: Column[], rows: { id: string; createdAt: number; data: Record<string, unknown> }[]): string {
  const header = ['Submitted', 'ID', ...columns.map((c) => c.label)].map(cell).join(',')
  const lines = rows.map((row) => [new Date(row.createdAt).toISOString(), row.id, ...columns.map((c) => plain(c, row.data[c.key]))].map(cell).join(','))
  return [header, ...lines].join('\r\n') + '\r\n'
}

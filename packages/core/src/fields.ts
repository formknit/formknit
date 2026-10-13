import { htmlToText, sanitizeHtml } from './html'
import { defineField, type FieldDefinition } from './registry'
import { ADDRESS_PARTS, type ComponentSchema } from './types'

const text = (v: unknown) => (v === null || v === undefined ? '' : String(v))
const NUMERIC = /^-?\d+(\.\d+)?$/

const inOptions = (c: ComponentSchema, v: unknown) => (c.options ?? []).some((o) => String(o.value) === String(v))

const realDate = (v: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v)
  if (!m) return false
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  return d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3])
}

const textual = (type: string, label: string, extra: Partial<FieldDefinition> = {}) =>
  defineField({ type, kind: 'input', label, group: 'Basic', emptyValue: '', coerce: text, ...extra })

textual('text', 'Text')
textual('textarea', 'Textarea')
textual('email', 'Email', {
  check: (v, _c, label, m) => (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v)) ? null : m.email(label)),
})
textual('phone', 'Phone', {
  check: (v, _c, label, m) => (/^\+?[\d\s().-]{6,20}$/.test(String(v)) ? null : m.phone(label)),
})
textual('date', 'Date', {
  check: (v, _c, label, m) => (realDate(String(v)) ? null : m.date(label)),
})
textual('time', 'Time', {
  check: (v, _c, label, m) => (/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(String(v)) ? null : m.time(label)),
})

defineField({
  type: 'number',
  kind: 'input',
  label: 'Number',
  group: 'Basic',
  emptyValue: null,
  coerce: (v) => {
    if (v === null || v === undefined || v === '') return null
    if (typeof v === 'string' && NUMERIC.test(v.trim())) return Number(v)
    return v
  },
  check: (v, _c, label, m) => (typeof v === 'number' && Number.isFinite(v) ? null : m.number(label)),
})

textual('url', 'Web address', {
  check: (v, _c, label, m) => (/^https?:\/\/[^\s/$.?#].\S*$/i.test(String(v)) ? null : m.url(label)),
})

const numeric = (type: string, label: string) =>
  defineField({
    type,
    kind: 'input',
    label,
    group: 'Basic',
    emptyValue: null,
    coerce: (v) => {
      if (v === null || v === undefined || v === '') return null
      if (typeof v === 'string' && NUMERIC.test(v.trim())) return Number(v)
      return v
    },
    check: (v, c, lbl, m) => {
      if (typeof v !== 'number' || !Number.isFinite(v)) return m.number(lbl)
      // A rating cannot exceed its number of stars, whatever the validation rules say.
      if (type === 'rating' && v > (typeof c.max === 'number' ? c.max : 5)) return m.max(lbl, typeof c.max === 'number' ? c.max : 5)
      return null
    },
  })

/** A whole number of stars, 1 up to the component's `max` (5 unless set). */
numeric('rating', 'Rating')
/** A number picked on a track between `validate.min` and `validate.max`. */
numeric('slider', 'Slider')

const record = (v: unknown): Record<string, unknown> | null => (typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null)

defineField({
  type: 'dateRange',
  kind: 'input',
  label: 'Date range',
  group: 'Basic',
  emptyValue: null,
  // Keeps only the two dates; a range with neither is empty.
  coerce: (v) => {
    const r = record(v)
    const range = { start: text(r?.start), end: text(r?.end) }
    return range.start || range.end ? range : null
  },
  check: (v, _c, label, m) => {
    const { start, end } = v as { start: string; end: string }
    if (!start || !end) return m.dateRange(label)
    if (!realDate(start) || !realDate(end)) return m.date(label)
    return end < start ? m.dateOrder(label) : null
  },
})

defineField({
  type: 'address',
  kind: 'input',
  label: 'Address',
  group: 'Basic',
  emptyValue: null,
  // Keeps only the known parts, as text; an address with nothing filled in is empty.
  coerce: (v) => {
    const r = record(v)
    const address = Object.fromEntries(ADDRESS_PARTS.map((part) => [part, text(r?.[part]).trim()]))
    return Object.values(address).some(Boolean) ? address : null
  },
  check: (v, _c, label, m) => {
    const a = v as { line1: string; city: string }
    return a.line1 && a.city ? null : m.address(label)
  },
})

/**
 * Formatted text from an editor, stored as HTML. It is cleaned every time it is read, on the
 * server too, so only harmless formatting survives. Lengths count the words, not the markup.
 */
textual('richText', 'Rich text', {
  coerce: (v) => {
    const html = sanitizeHtml(text(v))
    // An editor with nothing typed still sends an empty paragraph.
    return htmlToText(html) || /<hr>/.test(html) ? html : ''
  },
  lengthOf: (v) => htmlToText(String(v)).length,
})

defineField({ type: 'hidden', kind: 'input', label: 'Hidden', group: 'Basic', emptyValue: null })

const choice = (type: string, label: string) =>
  defineField({
    type,
    kind: 'input',
    label,
    group: 'Choice',
    usesOptions: true,
    emptyValue: '',
    coerce: text,
    check: (v, c, lbl, m) => (inOptions(c, v) ? null : m.option(lbl)),
  })

choice('select', 'Select')
choice('radio', 'Radio')

defineField({
  type: 'checkboxGroup',
  kind: 'input',
  label: 'Checkbox group',
  group: 'Choice',
  usesOptions: true,
  emptyValue: [],
  coerce: (v) => (Array.isArray(v) ? v.map(String) : v === null || v === undefined || v === '' ? [] : [String(v)]),
  check: (v, c, label, m) => ((v as unknown[]).every((x) => inOptions(c, x)) ? null : m.option(label)),
})

const boolean = (type: string, label: string) =>
  defineField({
    type,
    kind: 'input',
    label,
    group: 'Choice',
    emptyValue: false,
    coerce: (v) => v === true || v === 'true',
    // "Required" on a checkbox means it must be ticked.
    isEmpty: (v) => v !== true,
    requiredMessage: (label, m) => m.mustTick(label),
  })

boolean('checkbox', 'Checkbox')
boolean('toggle', 'Toggle')

const accepts = (accept: string, file: { name?: unknown; type?: unknown }) =>
  accept
    .split(',')
    .map((a) => a.trim().toLowerCase())
    .filter(Boolean)
    .some((a) => {
      const name = String(file.name ?? '').toLowerCase()
      const type = String(file.type ?? '').toLowerCase()
      if (a.startsWith('.')) return name.endsWith(a)
      if (a.endsWith('/*')) return type.startsWith(a.slice(0, -1))
      return type === a
    })

defineField({
  type: 'file',
  kind: 'input',
  label: 'File upload',
  group: 'Data',
  emptyValue: null,
  // The size and type are whatever the client reported; check the stored file itself if it matters.
  check: (v, c, label, m) => {
    if (typeof v !== 'object' || v === null) return null
    const file = v as { name?: unknown; size?: unknown; type?: unknown }
    const max = c.validate?.maxSizeMb
    if (max !== undefined && typeof file.size === 'number' && file.size > max * 1024 * 1024) return m.fileSize(label, max)
    if (c.accept && !accepts(c.accept, file)) return m.fileType(label, c.accept)
    return null
  },
})
/** A drawn signature, stored as a PNG data URL. */
defineField({
  type: 'signature',
  kind: 'input',
  label: 'Signature',
  group: 'Data',
  emptyValue: '',
  coerce: text,
  check: (v, _c, label, m) => (/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(String(v)) ? null : m.signature(label)),
})
/** A read-only value fetched from a data source, such as another form's submissions. */
defineField({ type: 'lookup', kind: 'input', label: 'Lookup', group: 'Data', emptyValue: null })
defineField({ type: 'calculated', kind: 'calculated', label: 'Calculated', group: 'Data', emptyValue: null })

defineField({ type: 'repeater', kind: 'repeater', label: 'Repeating group', group: 'Layout', emptyValue: [] })
defineField({ type: 'panel', kind: 'layout', label: 'Panel', group: 'Layout' })
defineField({ type: 'columns', kind: 'layout', label: 'Columns', group: 'Layout' })
defineField({ type: 'content', kind: 'content', label: 'Heading / text', group: 'Layout' })
defineField({ type: 'divider', kind: 'content', label: 'Divider', group: 'Layout' })

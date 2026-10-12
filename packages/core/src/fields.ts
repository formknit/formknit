import { defineField, type FieldDefinition } from './registry'
import type { ComponentSchema } from './types'

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

defineField({ type: 'file', kind: 'input', label: 'File upload', group: 'Data', emptyValue: null })
defineField({ type: 'calculated', kind: 'calculated', label: 'Calculated', group: 'Data', emptyValue: null })

defineField({ type: 'repeater', kind: 'repeater', label: 'Repeating group', group: 'Layout', emptyValue: [] })
defineField({ type: 'panel', kind: 'layout', label: 'Panel', group: 'Layout' })
defineField({ type: 'columns', kind: 'layout', label: 'Columns', group: 'Layout' })
defineField({ type: 'content', kind: 'content', label: 'Heading / text', group: 'Layout' })
defineField({ type: 'divider', kind: 'content', label: 'Divider', group: 'Layout' })

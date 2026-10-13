import { getField, listFields, type ComponentSchema } from '@formknit/core'

export type SettingInput = 'text' | 'textarea' | 'number' | 'checkbox' | 'select' | 'options' | 'expression' | 'formula' | 'rules' | 'columns' | 'key'
export type SettingTab = 'display' | 'validation' | 'logic'

export interface Setting {
  /** Property to edit, e.g. `label` or `validate.min`. */
  path: string
  label: string
  input: SettingInput
  tab: SettingTab
  help?: string
  /** Choices for a `select` setting. An empty value clears the property. */
  choices?: { label: string; value: string | number }[]
}

export interface BuilderField {
  /** Inner SVG markup for a 24x24 line icon. */
  icon?: string
  /** Properties a newly added component starts with. */
  defaults?: () => Partial<ComponentSchema>
  /** Extra settings, shown after the common ones. */
  settings?: Setting[]
}

const s = (path: string, label: string, input: SettingInput, tab: SettingTab, help?: string): Setting => ({ path, label, input, tab, help })

const LABEL = s('label', 'Label', 'text', 'display')
const KEY = s('key', 'Field key', 'key', 'display', 'Property name in the submitted data')
const PLACEHOLDER = s('placeholder', 'Placeholder', 'text', 'display')
const DESCRIPTION = s('description', 'Help text', 'text', 'display')
const REQUIRED = s('validate.required', 'Required', 'checkbox', 'validation')
const VISIBLE = s('visibleWhen', 'Show this field when', 'rules', 'logic')
const REQUIRED_WHEN = s('requiredWhen', 'Also required when', 'expression', 'logic')
const DISABLED_WHEN = s('disabledWhen', 'Read-only when', 'expression', 'logic')
const LENGTH = [
  s('validate.minLength', 'Minimum length', 'number', 'validation'),
  s('validate.maxLength', 'Maximum length', 'number', 'validation'),
  s('validate.pattern', 'Pattern', 'text', 'validation', 'A regular expression the whole value must match'),
  s('validate.patternMessage', 'Pattern error message', 'text', 'validation'),
]
const ITEMS = [s('validate.minItems', 'Minimum items', 'number', 'validation'), s('validate.maxItems', 'Maximum items', 'number', 'validation')]
const OPTIONS = s('options', 'Options', 'options', 'display')
const WIDTH: Setting = {
  ...s('width', 'Width', 'select', 'display', 'Narrow forms always stack fields full width'),
  choices: [
    { label: 'Full width', value: '' },
    { label: 'Three quarters', value: 9 },
    { label: 'Two thirds', value: 8 },
    { label: 'Half', value: 6 },
    { label: 'One third', value: 4 },
    { label: 'One quarter', value: 3 },
  ],
}
const CLASS = s('className', 'CSS classes', 'text', 'display', 'e.g. fx-hide-label, or your own')
const RANGE = [s('validate.min', 'Minimum', 'number', 'validation'), s('validate.max', 'Maximum', 'number', 'validation')]
const LOOKUP: Setting[] = [
  s('source', 'Data source', 'text', 'display', 'The name your app gives the data, e.g. students'),
  s('matchField', 'Field to match in the source', 'text', 'display'),
  s('matchValue', 'Value to match', 'expression', 'display', 'Usually another field in this form'),
  s('returnField', 'Field to return', 'text', 'display'),
  {
    ...s('aggregate', 'If several records match', 'select', 'display'),
    choices: [
      { label: 'Use the first', value: '' },
      { label: 'Use the last', value: 'last' },
      { label: 'Add them up', value: 'sum' },
      { label: 'Count them', value: 'count' },
      { label: 'Average them', value: 'avg' },
      { label: 'List them all', value: 'list' },
    ],
  },
]

const twoOptions = () => ({
  options: [
    { label: 'Option 1', value: 'option1' },
    { label: 'Option 2', value: 'option2' },
  ],
})

const ICONS: Record<string, string> = {
  text: '<path d="M5 6h14M12 6v13M9 19h6"/>',
  textarea: '<path d="M4 6h16M4 11h16M4 16h10"/>',
  email: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
  phone: '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>',
  number: '<path d="M9 4L7 20M17 4l-2 16M4 9h17M3 15h17"/>',
  date: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  time: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  hidden: '<path d="M3 3l18 18M10.6 6.2A9.5 9.5 0 0 1 12 6c5 0 9 6 9 6a15 15 0 0 1-2.6 3.1M6.5 7.6A15 15 0 0 0 3 12s4 6 9 6a9 9 0 0 0 3.4-.7"/>',
  file: '<path d="M12 16V4M7 9l5-5 5 5M4 17v3h16v-3"/>',
  select: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M9 11l3 3 3-3"/>',
  radio: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/>',
  checkbox: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 12l3 3 5-6"/>',
  checkboxGroup: '<rect x="3" y="4" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><path d="M14 7.5h7M14 17.5h7"/>',
  toggle: '<rect x="2" y="7" width="20" height="10" rx="5"/><circle cx="16" cy="12" r="2.5"/>',
  calculated: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 12h2M14 12h2M8 16h2M14 16h2"/>',
  panel: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18"/>',
  columns: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M12 4v16"/>',
  repeater: '<rect x="3" y="4" width="18" height="6" rx="1.5"/><rect x="3" y="14" width="18" height="6" rx="1.5"/>',
  content: '<path d="M6 5v14M18 5v14M6 12h12"/>',
  divider: '<path d="M3 12h18"/>',
  url: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  rating: '<path d="M12 3l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.8 6.6 19.7l1.1-6.1L3.2 9.4l6.1-.8z"/>',
  slider: '<path d="M3 12h18"/><circle cx="9" cy="12" r="3"/>',
  lookup: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  dateRange: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4M8 15h8"/>',
  address: '<path d="M12 21s7-6.2 7-11a7 7 0 0 0-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  signature: '<path d="M3 17c3-6 5-9 6-8s-2 7-1 8 4-6 5-5-1 4 0 4 3-2 4-2M3 21h18"/>',
  richText: '<path d="M4 6h16M4 11h10M4 16h16M4 21h7"/><path d="M17 9.5l3 3-3 3"/>',
  other: '<rect x="4" y="4" width="16" height="16" rx="3"/>',
}

const registry = new Map<string, BuilderField>([
  ['text', { settings: [PLACEHOLDER, ...LENGTH] }],
  ['textarea', { settings: [PLACEHOLDER, s('rows', 'Rows', 'number', 'display'), ...LENGTH] }],
  ['richText', { settings: [PLACEHOLDER, s('toolbar', 'Toolbar buttons', 'text', 'display', 'e.g. bold, italic, link'), ...LENGTH] }],
  ['email', { settings: [PLACEHOLDER] }],
  ['phone', { settings: [PLACEHOLDER] }],
  ['number', { settings: [PLACEHOLDER, ...RANGE] }],
  ['url', { settings: [PLACEHOLDER] }],
  ['rating', { defaults: () => ({ max: 5 }), settings: [s('max', 'Number of stars', 'number', 'display')] }],
  ['slider', { defaults: () => ({ validate: { min: 0, max: 100 } }), settings: [s('step', 'Step', 'number', 'display'), ...RANGE] }],
  ['file', { settings: [s('accept', 'Accepted types', 'text', 'validation', 'e.g. .pdf,image/*'), s('validate.maxSizeMb', 'Largest size (MB)', 'number', 'validation')] }],
  ['lookup', { settings: LOOKUP }],
  ['date', { settings: [s('validate.min', 'Earliest date', 'text', 'validation', 'YYYY-MM-DD'), s('validate.max', 'Latest date', 'text', 'validation', 'YYYY-MM-DD')] }],
  ['select', { defaults: twoOptions, settings: [PLACEHOLDER, OPTIONS] }],
  ['radio', { defaults: twoOptions, settings: [OPTIONS] }],
  ['checkboxGroup', { defaults: twoOptions, settings: [OPTIONS, ...ITEMS] }],
  ['calculated', { defaults: () => ({ expression: '0' }), settings: [s('expression', 'Formula', 'formula', 'display')] }],
  ['repeater', { defaults: () => ({ components: [] }), settings: [s('compact', 'Compact rows, like a table', 'checkbox', 'display'), ...ITEMS] }],
  ['panel', { defaults: () => ({ components: [] }) }],
  ['columns', { defaults: () => ({ columns: [{ components: [] }, { components: [] }] }), settings: [s('columns', 'Columns', 'columns', 'display')] }],
  ['content', { defaults: () => ({ content: 'Text' }), settings: [s('content', 'Text', 'textarea', 'display'), s('heading', 'Show as a heading', 'checkbox', 'display')] }],
])

/** Tells the builder how to present a custom field type: its icon, starting properties and extra settings. */
export function registerBuilderField(type: string, field: BuilderField): void {
  registry.set(type, field)
}

export const iconFor = (type: string): string => registry.get(type)?.icon ?? ICONS[type] ?? ICONS.other

/** The settings shown for a component, in order. */
export function settingsFor(type: string): Setting[] {
  const kind = getField(type)?.kind
  const extra = registry.get(type)?.settings ?? []
  const layout = [WIDTH, CLASS]
  if (kind === 'content') return [...extra, ...layout, VISIBLE]
  if (kind === 'layout') return [...(type === 'panel' ? [LABEL] : []), ...extra, ...layout, VISIBLE]
  if (kind === 'calculated' || type === 'lookup') return [LABEL, KEY, ...extra, DESCRIPTION, ...layout, ...(type === 'lookup' ? [REQUIRED] : []), VISIBLE]
  if (kind === 'repeater') return [LABEL, KEY, DESCRIPTION, ...extra.filter((x) => x.tab === 'display'), ...layout, REQUIRED, ...extra.filter((x) => x.tab !== 'display'), VISIBLE, REQUIRED_WHEN]
  const label = type === 'hidden' ? [] : [LABEL]
  return [
    ...label, KEY, ...extra.filter((x) => x.tab === 'display'), DESCRIPTION, ...(type === 'hidden' ? [] : layout),
    REQUIRED, ...extra.filter((x) => x.tab !== 'display'), VISIBLE, REQUIRED_WHEN, DISABLED_WHEN,
  ]
}

/** A new component of the given type, without a key. */
export function newComponent(type: string): ComponentSchema {
  const def = getField(type)
  const data = def?.kind === 'input' || def?.kind === 'calculated' || def?.kind === 'repeater'
  const labelled = data && type !== 'hidden'
  return { type, ...(labelled || type === 'panel' ? { label: def?.label ?? type } : {}), ...registry.get(type)?.defaults?.() }
}

/** Field types grouped for the palette, in registration order. */
export function paletteGroups(): { group: string; fields: { type: string; label: string }[] }[] {
  const groups = new Map<string, { type: string; label: string }[]>()
  for (const def of listFields()) {
    if (!groups.has(def.group)) groups.set(def.group, [])
    groups.get(def.group)!.push({ type: def.type, label: def.label })
  }
  return [...groups].map(([group, fields]) => ({ group, fields }))
}

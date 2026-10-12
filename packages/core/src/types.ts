export interface Option {
  label: string
  value: string
}

export interface ValidationRule {
  /** Must be true for the value to pass. The field's own value is available as `$value`. */
  expression: string
  message: string
}

export interface Validation {
  required?: boolean
  minLength?: number
  maxLength?: number
  /** A number, or a YYYY-MM-DD date for date fields. */
  min?: number | string
  max?: number | string
  pattern?: string
  patternMessage?: string
  minItems?: number
  maxItems?: number
  /** Largest file allowed, in megabytes. */
  maxSizeMb?: number
  rules?: ValidationRule[]
}

/** How to fetch a value from somewhere else, such as another form's submissions. */
export interface LookupQuery {
  /** Name of the data source, e.g. `students`. */
  source: string
  /** Records must match these values, e.g. `{ rollNo: '2027-0142' }`. */
  where: Record<string, unknown>
  /** Field to read from the matching records. */
  select: string | undefined
  /** What to do with the matches. `first` and `last` return one value; the others combine them. */
  aggregate: 'first' | 'last' | 'sum' | 'count' | 'avg' | 'list'
}

/** Look and feel that travels with the schema. Props on `<Form>` override it. */
export interface Appearance {
  size?: 'sm' | 'md' | 'lg'
  variant?: 'outlined' | 'filled' | 'underline'
  labelPosition?: 'top' | 'left'
  theme?: 'light' | 'dark' | 'auto'
}

export interface ColumnSchema {
  /** Relative width; columns share the row in proportion. */
  width?: number
  components: ComponentSchema[]
}

export interface ComponentSchema {
  type: string
  /** Property name in the submitted data. Required for fields that hold a value. */
  key?: string
  label?: string
  placeholder?: string
  description?: string
  defaultValue?: unknown
  validate?: Validation
  /** Expression. The field is shown, validated and submitted only while this is true. */
  visibleWhen?: string
  /** Expression. Makes the field required while true, in addition to `validate.required`. */
  requiredWhen?: string
  /** Expression. A disabled field keeps its value but is read-only and not validated. */
  disabledWhen?: string
  /** Formula for `calculated` fields. */
  expression?: string
  options?: Option[]
  /** Children of a panel or repeater. */
  components?: ComponentSchema[]
  /** Children of a `columns` layout. */
  columns?: ColumnSchema[]
  /** Width in twelfths of the row: 12 is full width, 6 is half. Collapses to full width on narrow forms. */
  width?: number
  /** Extra CSS classes for the component's wrapper. */
  className?: string
  /** Lookup fields: the data source to read. */
  source?: string
  /** Lookup fields: the field in the source that must match. */
  matchField?: string
  /** Lookup fields: expression giving the value to match, usually another field's key. */
  matchValue?: string
  /** Lookup fields: the field to return. */
  returnField?: string
  /** Lookup fields: how to combine several matches. Defaults to `first`. */
  aggregate?: LookupQuery['aggregate']
  /** File fields: accepted types, e.g. `.pdf,image/*`. */
  accept?: string
  /** Repeaters: show each row's fields side by side, like a table row. */
  compact?: boolean
  /** Text for `content` components. */
  content?: string
  /** Custom field types may add their own settings. */
  [extra: string]: unknown
}

export interface PageSchema {
  key: string
  title?: string
  description?: string
  /** Expression. A hidden page is skipped, and its fields are neither validated nor submitted. */
  visibleWhen?: string
  components: ComponentSchema[]
}

export interface FormSchema {
  version: 1
  title?: string
  description?: string
  submitLabel?: string
  appearance?: Appearance
  /** A single-page form has one page. */
  pages: PageSchema[]
}

export type FormValues = Record<string, unknown>

export interface SchemaIssue {
  level: 'error' | 'warning'
  message: string
  /** Where in the schema, e.g. `items.amount`. */
  path: string
}

export interface DateRange {
  /** `YYYY-MM-DD` */
  start: string
  /** `YYYY-MM-DD` */
  end: string
}

export interface Address {
  line1: string
  line2: string
  city: string
  region: string
  postcode: string
  country: string
}

export const ADDRESS_PARTS = ['line1', 'line2', 'city', 'region', 'postcode', 'country'] as const

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
  rules?: ValidationRule[]
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

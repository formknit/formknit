import type { Address, ComponentSchema, DateRange, FormSchema, Option, PageSchema } from './types'

type Shape = Record<string, unknown>
type UnionToIntersection<U> = (U extends unknown ? (k: U) => void : never) extends (k: infer I) => void ? I : never
type Simplify<T> = { [K in keyof T]: T[K] } & {}
type AnyBuilder = FieldBuilder<any>
type ShapeOf<T extends readonly AnyBuilder[]> = Simplify<UnionToIntersection<T[number]['_shape']>>

/**
 * Describes one component in code. Every method returns the same builder, so calls chain:
 * `text('name').label('Full name').required()`. The result is plain schema JSON.
 */
export class FieldBuilder<S extends Shape = {}> {
  /** Type-only: the data this component contributes. Never set at runtime. */
  declare readonly _shape: S

  constructor(readonly schema: ComponentSchema) {}

  /** Sets any schema property, including ones a custom field type defines. */
  set(props: Partial<ComponentSchema>): this {
    Object.assign(this.schema, props)
    return this
  }
  private rule(props: NonNullable<ComponentSchema['validate']>): this {
    this.schema.validate = { ...this.schema.validate, ...props }
    return this
  }

  label(label: string) {
    return this.set({ label })
  }
  placeholder(placeholder: string) {
    return this.set({ placeholder })
  }
  description(description: string) {
    return this.set({ description })
  }
  default(defaultValue: unknown) {
    return this.set({ defaultValue })
  }
  required(required = true) {
    return this.rule({ required })
  }
  min(min: number | string) {
    return this.rule({ min })
  }
  max(max: number | string) {
    return this.rule({ max })
  }
  minLength(minLength: number) {
    return this.rule({ minLength })
  }
  maxLength(maxLength: number) {
    return this.rule({ maxLength })
  }
  minItems(minItems: number) {
    return this.rule({ minItems })
  }
  maxItems(maxItems: number) {
    return this.rule({ maxItems })
  }
  /** The whole value must match. Pass a message to replace the default one. */
  pattern(pattern: string | RegExp, patternMessage?: string) {
    return this.rule({ pattern: typeof pattern === 'string' ? pattern : pattern.source, patternMessage })
  }
  /** A custom rule: the expression must be true. The field's own value is `$value`. */
  check(expression: string, message: string) {
    return this.rule({ rules: [...(this.schema.validate?.rules ?? []), { expression, message }] })
  }
  /** Width in twelfths of the row: 6 is half, 4 a third. Collapses to full width on narrow forms. */
  width(width: number) {
    return this.set({ width })
  }
  /** Extra CSS classes for the component's wrapper. */
  className(className: string) {
    return this.set({ className })
  }
  visibleWhen(visibleWhen: string) {
    return this.set({ visibleWhen })
  }
  requiredWhen(requiredWhen: string) {
    return this.set({ requiredWhen })
  }
  disabledWhen(disabledWhen: string) {
    return this.set({ disabledWhen })
  }
}

type One<K extends string, V> = FieldBuilder<{ [P in K]: V }>
const make = <K extends string, V>(type: string, key: K, extra: Partial<ComponentSchema> = {}): One<K, V> =>
  new FieldBuilder({ type, key, ...extra })

type Choices<O extends string> = Readonly<Record<O, string>> | readonly { label: string; value: O }[]
const toOptions = (choices: Choices<string>): Option[] =>
  Array.isArray(choices)
    ? choices.map((o) => ({ label: o.label, value: o.value }))
    : Object.entries(choices as Record<string, string>).map(([value, label]) => ({ label, value }))

export const text = <K extends string>(key: K) => make<K, string>('text', key)
export const textarea = <K extends string>(key: K) => make<K, string>('textarea', key)
export const email = <K extends string>(key: K) => make<K, string>('email', key)
export const phone = <K extends string>(key: K) => make<K, string>('phone', key)
/** Value is a `YYYY-MM-DD` string. */
export const date = <K extends string>(key: K) => make<K, string>('date', key)
/** Value is an `HH:MM` string. */
export const time = <K extends string>(key: K) => make<K, string>('time', key)
export const number = <K extends string>(key: K) => make<K, number | null>('number', key)
export const hidden = <K extends string>(key: K) => make<K, unknown>('hidden', key)
export const checkbox = <K extends string>(key: K) => make<K, boolean>('checkbox', key)
export const toggle = <K extends string>(key: K) => make<K, boolean>('toggle', key)
export const file = <K extends string>(key: K) => make<K, unknown>('file', key)

export const url = <K extends string>(key: K) => make<K, string>('url', key)
/** Stars from 1 to `max` (5 unless given). */
export const rating = <K extends string>(key: K, max = 5) => make<K, number | null>('rating', key, { max })
/** A number picked on a track. Set the range with `.min()` and `.max()`. */
export const slider = <K extends string>(key: K) => make<K, number | null>('slider', key)

/** Two dates, stored as `{ start, end }`. */
export const dateRange = <K extends string>(key: K) => make<K, DateRange | null>('dateRange', key)
/** Street, city, region, postcode and country in one field. */
export const address = <K extends string>(key: K) => make<K, Address | null>('address', key)
/** A drawn signature, stored as a PNG data URL. */
export const signature = <K extends string>(key: K) => make<K, string>('signature', key)

/**
 * A read-only value fetched from a data source, e.g.
 * `lookup('studentName', { source: 'students', matchField: 'rollNo', matchValue: 'rollNumber', returnField: 'fullName' })`.
 */
export const lookup = <K extends string, V = unknown>(
  key: K,
  query: { source: string; matchField: string; matchValue: string; returnField?: string; aggregate?: ComponentSchema['aggregate'] },
) => make<K, V | null>('lookup', key, query)

/** Choices as `{ value: 'Label' }` or as a list of `{ label, value }`. */
export const select = <K extends string, O extends string>(key: K, choices: Choices<O>) =>
  make<K, O | ''>('select', key, { options: toOptions(choices) })
export const radio = <K extends string, O extends string>(key: K, choices: Choices<O>) =>
  make<K, O | ''>('radio', key, { options: toOptions(choices) })
export const checkboxGroup = <K extends string, O extends string>(key: K, choices: Choices<O>) =>
  make<K, O[]>('checkboxGroup', key, { options: toOptions(choices) })

/** A read-only value worked out from other fields, e.g. `calculated('total', 'SUM(items.amount)')`. */
export const calculated = <K extends string, V = number>(key: K, expression: string) =>
  make<K, V | null>('calculated', key, { expression })

/** A list of rows; each row has the given fields. */
export const repeater = <K extends string, const T extends readonly AnyBuilder[]>(key: K, children: T) =>
  new FieldBuilder<{ [P in K]: ShapeOf<T>[] }>({ type: 'repeater', key, components: children.map((c) => c.schema) })

/** A titled group. It does not nest the data. */
export const panel = <const T extends readonly AnyBuilder[]>(label: string, children: T) =>
  new FieldBuilder<ShapeOf<T>>({ type: 'panel', label, components: children.map((c) => c.schema) })

/** Fields side by side: one list of fields per column. */
export const columns = <const T extends readonly (readonly AnyBuilder[])[]>(...cols: T) =>
  new FieldBuilder<ShapeOf<T[number]>>({
    type: 'columns',
    columns: cols.map((col) => ({ components: col.map((c) => c.schema) })),
  })

/** Static text. Pass `{ heading: true }` for a heading. */
export const content = (text: string, opts: { heading?: boolean } = {}) =>
  new FieldBuilder<{}>({ type: 'content', content: text, ...opts })
export const divider = () => new FieldBuilder<{}>({ type: 'divider' })

/** A field of any type, for custom field types. Give the value type as `field<'rating', number>(...)`. */
export const field = <K extends string, V = unknown>(type: string, key: K, props: Partial<ComponentSchema> = {}) =>
  make<K, V>(type, key, props)

export class PageBuilder<S extends Shape = {}> {
  declare readonly _shape: S
  constructor(readonly schema: PageSchema) {}
  description(description: string) {
    this.schema.description = description
    return this
  }
  visibleWhen(visibleWhen: string) {
    this.schema.visibleWhen = visibleWhen
    return this
  }
}

/** One step of a multi-step form. */
export const page = <const T extends readonly AnyBuilder[]>(key: string, title: string, children: T) =>
  new PageBuilder<ShapeOf<T>>({ key, title, components: children.map((c) => c.schema) })

/** A form schema that also remembers, for TypeScript only, the shape of its data. */
export type FormDefinition<S extends Shape = Shape> = FormSchema & { readonly _shape?: S }

/** The type of the data a form produces: `type Data = InferData<typeof myForm>`. */
export type InferData<T> = T extends { readonly _shape?: infer S } ? (S extends Shape ? Simplify<S> : never) : never

type Children = readonly AnyBuilder[] | readonly PageBuilder<any>[]
type FormShape<T extends Children> = Simplify<UnionToIntersection<T[number]['_shape']>>

/**
 * Builds a form schema. Pass fields for a single-page form, or `page(...)`s for a multi-step one.
 */
export function form<const T extends Children>(
  title: string,
  children: T,
  opts: { description?: string; submitLabel?: string } = {},
): FormDefinition<FormShape<T>> {
  const isPages = children.length > 0 && children.every((c) => c instanceof PageBuilder)
  const pages: PageSchema[] = isPages
    ? (children as readonly PageBuilder<any>[]).map((p) => p.schema)
    : [{ key: 'main', components: (children as readonly AnyBuilder[]).map((c) => c.schema) }]
  return { version: 1, title, ...opts, pages }
}

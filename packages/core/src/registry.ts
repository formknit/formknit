import type { Messages } from './messages'
import type { ComponentSchema } from './types'

/**
 * - `input`: holds a value the user enters
 * - `calculated`: holds a value produced by a formula
 * - `repeater`: holds a list of rows, each with its own fields
 * - `layout`: groups other components without affecting the data
 * - `content`: displays something and holds no value
 */
export type FieldKind = 'input' | 'calculated' | 'repeater' | 'layout' | 'content'

export interface FieldDefinition {
  type: string
  kind: FieldKind
  /** Human name, shown in the builder. */
  label: string
  /** Builder palette group. */
  group: string
  /** True when the field needs an `options` list. */
  usesOptions?: boolean
  /** Value submitted when the field is left empty. Defaults to an empty string. */
  emptyValue?: unknown
  /** Normalises a raw value, e.g. turns "12" from a text box into 12. */
  coerce?(value: unknown, component: ComponentSchema): unknown
  /** Overrides what counts as empty for `required`. */
  isEmpty?(value: unknown): boolean
  /** What `minLength` and `maxLength` count, when it is not simply the stored text. */
  lengthOf?(value: unknown): number
  /** Message when the field is required but empty. Defaults to "… is required". */
  requiredMessage?(label: string, messages: Messages): string
  /** Type-specific check of a non-empty value. Returns an error message or null. */
  check?(value: unknown, component: ComponentSchema, label: string, messages: Messages): string | null
}

const fields = new Map<string, FieldDefinition>()

/** Registers a field type, or replaces one with the same `type`. */
export function defineField(def: FieldDefinition): FieldDefinition {
  fields.set(def.type, def)
  return def
}

export const getField = (type: string): FieldDefinition | undefined => fields.get(type)
export const listFields = (): FieldDefinition[] => [...fields.values()]

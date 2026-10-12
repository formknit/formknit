import type { ComponentSchema, FormSchema, FormValues, Option } from '@formknit/core'
import type { ComponentType, ReactNode } from 'react'
import type { PageInfo } from './store'

/** The data type of a form built with the code-first builders; plain values otherwise. */
export type DataOf<S> = S extends { readonly _shape?: infer D }
  ? D extends Record<string, unknown>
    ? { [K in keyof D]: D[K] }
    : FormValues
  : FormValues

/** What every field component receives. Render the label, control, description and error. */
export interface FieldProps<V = unknown> {
  /** Unique id for the control; point the label's `htmlFor` at it. */
  id: string
  /** Location in the data, e.g. `items.0.qty`. */
  path: string
  component: ComponentSchema
  label: string | undefined
  description: string | undefined
  placeholder: string | undefined
  options: Option[]
  value: V
  onChange: (value: V) => void
  onBlur: () => void
  /** The message to show now, if any. */
  error: string | undefined
  required: boolean
  disabled: boolean
}

export interface PanelProps {
  component: ComponentSchema
  children: ReactNode
}

export interface ColumnsProps {
  component: ComponentSchema
  columns: { width: number; children: ReactNode }[]
}

export interface ContentProps {
  component: ComponentSchema
}

export interface RepeaterRow {
  index: number
  path: string
  children: ReactNode
  remove: () => void
  moveUp: (() => void) | undefined
  moveDown: (() => void) | undefined
}

export interface RepeaterProps {
  id: string
  path: string
  component: ComponentSchema
  label: string | undefined
  description: string | undefined
  rows: RepeaterRow[]
  /** Undefined when the list is full or disabled. */
  add: (() => void) | undefined
  error: string | undefined
  required: boolean
  disabled: boolean
  labels: Labels
}

export interface ButtonProps {
  type: 'button' | 'submit'
  variant: 'primary' | 'secondary'
  disabled?: boolean
  onClick?: () => void
  children: ReactNode
}

export interface StepsProps {
  pages: PageInfo[]
  step: number
}

/** Maps every piece of a form to a component. Swap it to render with another UI library. */
export interface Adapter {
  /** Field components by field type. */
  fields: Record<string, ComponentType<FieldProps<any>>>
  /** Layout components by type. Unlisted layout types use `panel`. */
  layout: {
    panel: ComponentType<PanelProps>
    columns: ComponentType<ColumnsProps>
    content: ComponentType<ContentProps>
    divider: ComponentType<ContentProps>
    repeater: ComponentType<RepeaterProps>
    [type: string]: ComponentType<any>
  }
  ui: {
    Button: ComponentType<ButtonProps>
    Steps: ComponentType<StepsProps>
  }
}

export type PartialAdapter = { [K in keyof Adapter]?: Partial<Adapter[K]> }

/** Text used by the form chrome. Replace to translate. */
export interface Labels {
  submit: string
  next: string
  back: string
  add: string
  remove: string
  moveUp: string
  moveDown: string
  step: (current: number, total: number) => string
  unknownField: (type: string) => string
}

export const defaultLabels: Labels = {
  submit: 'Submit',
  next: 'Next',
  back: 'Back',
  add: 'Add',
  remove: 'Remove',
  moveUp: 'Move up',
  moveDown: 'Move down',
  step: (current, total) => `Step ${current} of ${total}`,
  unknownField: (type) => `Unknown field type "${type}"`,
}

export type { FormSchema }

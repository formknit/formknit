import type { ComponentSchema, FormSchema } from '@formknit/core'
import type { Adapter } from '@formknit/react'
import { createContext, useContext } from 'react'
import type { Path } from './ops'

export type Drag = { kind: 'new'; type: string } | { kind: 'move'; path: string }

export interface Builder {
  schema: FormSchema
  adapter: Adapter
  pageIndex: number
  setPageIndex: (index: number) => void
  /** Path key of the selected component, or null when the page and form settings are shown. */
  selected: string | null
  select: (key: string | null) => void
  /**
   * Edits a copy of the schema and records it for undo. Return a component from the copy
   * to select it, or null to clear the selection. Edits with the same `coalesce` key made
   * in quick succession, such as typing in one box, count as one undo step.
   */
  apply: (edit: (draft: FormSchema) => ComponentSchema | null | void, coalesce?: string) => void
  /** Replaces the whole schema, e.g. from the JSON view. */
  replace: (schema: FormSchema, coalesce?: string) => void
  drag: Drag | null
  setDrag: (drag: Drag | null) => void
  indicator: { list: string; index: number } | null
  setIndicator: (indicator: { list: string; index: number } | null) => void
  /** Completes the current drag at a position in a list. */
  drop: (listPath: Path, index: number) => void
  /** Adds a field from the palette without dragging. */
  add: (type: string) => void
}

export const BuilderContext = createContext<Builder | null>(null)

export function useBuilder(): Builder {
  const ctx = useContext(BuilderContext)
  if (!ctx) throw new Error('This component must be rendered inside <FormBuilder>')
  return ctx
}

export const cx = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(' ')

export function Icon({ markup, size = 16 }: { markup: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  )
}

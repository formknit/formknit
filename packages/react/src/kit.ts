import { listFields } from '@formknit/core'
import { defaultAdapter } from './skin'
import type { PartialAdapter } from './types'

/**
 * Reports how complete an adapter is: which field types and layouts it renders itself,
 * and which fall back to the built-in skin (or to nothing, for custom types with no component).
 * Useful in an adapter's own tests.
 */
export function describeAdapter(adapter: PartialAdapter): { own: string[]; fallback: string[]; missing: string[] } {
  const own: string[] = []
  const fallback: string[] = []
  const missing: string[] = []
  for (const def of listFields()) {
    const data = def.kind === 'input' || def.kind === 'calculated'
    const mine = data ? adapter.fields?.[def.type] : adapter.layout?.[def.type]
    const builtIn = data ? defaultAdapter.fields[def.type] : defaultAdapter.layout[def.type]
    if (mine) own.push(def.type)
    else if (builtIn) fallback.push(def.type)
    else missing.push(def.type)
  }
  return { own, fallback, missing }
}

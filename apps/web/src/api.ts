import type { FormSchema, SchemaIssue } from '@formknit/core'
import { useCallback, useEffect, useState } from 'react'

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields: Record<string, string[]> = {},
  ) {
    super(message)
  }
}

export async function api<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(`/api${path}`, {
      method: options.method ?? 'GET',
      credentials: 'same-origin',
      headers: options.body === undefined ? undefined : { 'content-type': 'application/json' },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    })
  } catch {
    throw new ApiError(0, 'offline', 'Could not reach the server. Check your connection and try again.')
  }
  const json = await res.json().catch(() => null)
  if (!res.ok) {
    const e = json?.error
    throw new ApiError(res.status, e?.code ?? 'error', e?.message ?? `The server answered with an error (${res.status})`, e?.fields)
  }
  return json as T
}

/** Loads data when the component mounts or `deps` change. */
export function useLoad<T>(load: () => Promise<T>, deps: unknown[]) {
  const [state, setState] = useState<{ data?: T; error?: ApiError; loading: boolean }>({ loading: true })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(load, deps)
  const reload = useCallback(() => {
    let current = true
    setState((s) => ({ ...s, loading: true }))
    run().then(
      (data) => current && setState({ data, loading: false }),
      (error) => current && setState({ error: error instanceof ApiError ? error : new ApiError(0, 'error', String(error)), loading: false }),
    )
    return () => {
      current = false
    }
  }, [run])
  useEffect(() => reload(), [reload])
  return { ...state, reload, setData: (data: T) => setState({ data, loading: false }) }
}

export interface User {
  id: string
  email: string
  name: string
}

export interface FormSummary {
  id: string
  name: string
  slug: string
  status: 'draft' | 'published'
  publishedAt: number | null
  updatedAt: number
  submissions: number
  unpublishedChanges: boolean
  closedReason: string | null
}

export interface FormSettings {
  successMessage?: string
  closed?: boolean
  maxSubmissions?: number
  exposedFields?: string[]
  opensAt?: string
  closesAt?: string
  notifyEmails?: string[]
}

export const STATUSES = ['new', 'in_review', 'approved', 'rejected'] as const
export type Status = (typeof STATUSES)[number]
export const STATUS_LABEL: Record<Status, string> = { new: 'New', in_review: 'In review', approved: 'Approved', rejected: 'Rejected' }
export const STATUS_CLASS: Record<Status, string> = { new: 'badge warn', in_review: 'badge info', approved: 'badge ok', rejected: 'badge bad' }
export const CLOSED_TEXT: Record<string, string> = {
  closed: 'Closed',
  not_open: 'Not open yet',
  ended: 'Ended',
  full: 'Full',
}

export interface FormDetail extends FormSummary {
  schema: FormSchema
  settings: FormSettings
  issues: SchemaIssue[]
}

export interface Submission {
  id: string
  formId: string
  data: Record<string, unknown>
  status: Status
  createdAt: number
}

export interface Column {
  key: string
  label: string
}

export const when = (ms: number) => new Date(ms).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })

/** A stored answer as short text for tables. */
export function show(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (Array.isArray(value)) return value.length && typeof value[0] === 'object' ? `${value.length} ${value.length === 1 ? 'row' : 'rows'}` : value.join(', ')
  if (typeof value === 'object') {
    const v = value as Record<string, unknown>
    if ('start' in v && 'end' in v) return `${v.start} – ${v.end}`
    if ('line1' in v) return [v.line1, v.city, v.country].filter(Boolean).join(', ')
    if ('name' in v) return String(v.name)
    return JSON.stringify(value)
  }
  const text = String(value)
  return text.startsWith('data:image/') ? 'Signed' : text
}

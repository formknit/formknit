import { sanitizeHtml } from '@formknit/core'
import type { FieldProps } from '@formknit/react'
import type { AnyExtension } from '@tiptap/react'
import type { ComponentType } from 'react'
import { RichTextEditor, type RichTextEditorProps, type RichTextLabels } from './Editor'
import { parseToolbar, type ToolbarItem } from './toolbar'

export interface RichTextOptions {
  /** Buttons to show when the field itself does not say. `|` leaves a gap; an empty list hides the toolbar. */
  toolbar?: string[]
  /** Extra or replacement toolbar buttons, by name. */
  items?: Record<string, ToolbarItem>
  /** Tiptap extensions added after the standard set. */
  extensions?: AnyExtension[]
  /** Replaces the standard set of Tiptap extensions entirely. */
  baseExtensions?: AnyExtension[]
  labels?: Partial<RichTextLabels>
  /** Hands over the Tiptap editor of each field once it exists. */
  onReady?: RichTextEditorProps['onReady']
}

/**
 * Makes a rich text field component. A field's own `toolbar` setting (from the schema or the
 * visual builder) wins over the one given here.
 */
export function createRichTextField(options: RichTextOptions = {}): ComponentType<FieldProps<string>> {
  return function RichTextField(p) {
    const describedBy = [p.description && `${p.id}-desc`, p.error && `${p.id}-err`].filter(Boolean).join(' ') || undefined
    return (
      <div className="fx-field">
        {p.label && (
          // Not a <label>: the editor is not a form control, so it is tied to this by id instead.
          <div className="fx-label" id={`${p.id}-label`} onClick={() => document.getElementById(p.id)?.focus()}>
            {p.label}
            {p.required && (
              <span className="fx-required" aria-hidden="true">
                {' '}
                *
              </span>
            )}
          </div>
        )}
        <RichTextEditor
          id={p.id}
          value={typeof p.value === 'string' ? p.value : ''}
          onChange={p.onChange}
          onBlur={p.onBlur}
          placeholder={p.placeholder}
          disabled={p.disabled}
          invalid={!!p.error}
          required={p.required}
          toolbar={parseToolbar(p.component.toolbar) ?? options.toolbar}
          items={options.items}
          extensions={options.extensions}
          baseExtensions={options.baseExtensions}
          labels={options.labels}
          onReady={options.onReady}
          aria-labelledby={p.label ? `${p.id}-label` : undefined}
          aria-describedby={describedBy}
        />
        {p.description && (
          <div className="fx-description" id={`${p.id}-desc`}>
            {p.description}
          </div>
        )}
        <div className="fx-error" id={`${p.id}-err`} aria-live="polite">
          {p.error}
        </div>
      </div>
    )
  }
}

/** The rich text field with the standard toolbar. */
export const RichTextField = createRichTextField()

type FieldMap = Record<string, ComponentType<FieldProps<any>>>

/**
 * Returns the components with their `richText` field replaced by this editor. Works on a full
 * adapter, on the partial one you pass to `<Form components>`, or on nothing at all.
 */
export function withRichText<A extends { fields?: FieldMap }>(adapter?: A, options?: RichTextOptions): A & { fields: FieldMap } {
  return { ...(adapter as A), fields: { ...adapter?.fields, richText: options ? createRichTextField(options) : RichTextField } }
}

/** Shows stored rich text. The HTML is cleaned again first, so it is safe even if it was stored some other way. */
export function RichTextView({ html, className }: { html: string; className?: string }) {
  return <div className={['fx-richtext-view', className].filter(Boolean).join(' ')} dangerouslySetInnerHTML={{ __html: sanitizeHtml(html ?? '') }} />
}

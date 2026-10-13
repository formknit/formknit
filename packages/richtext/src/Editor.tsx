import { sanitizeHtml } from '@formknit/core'
import Placeholder from '@tiptap/extension-placeholder'
import { EditorContent, useEditor, type AnyExtension, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useEffect, useMemo, useRef, useState } from 'react'
import { DEFAULT_TOOLBAR, toolbarItems, type ToolbarItem } from './toolbar'

export interface RichTextLabels {
  toolbar: string
  linkAddress: string
  applyLink: string
  removeLink: string
}

export const defaultRichTextLabels: RichTextLabels = {
  toolbar: 'Formatting',
  linkAddress: 'Link address',
  applyLink: 'Apply',
  removeLink: 'Remove link',
}

export interface RichTextEditorProps {
  /** The stored HTML. */
  value: string
  /** Called with cleaned-up HTML, or an empty string when nothing is typed. */
  onChange: (html: string) => void
  onBlur?: () => void
  id?: string
  placeholder?: string
  disabled?: boolean
  invalid?: boolean
  required?: boolean
  /** Button names in order; `|` leaves a gap. An empty list hides the toolbar. */
  toolbar?: string[]
  /** Extra or replacement buttons, by name. */
  items?: Record<string, ToolbarItem>
  /** Tiptap extensions added after the standard set. */
  extensions?: AnyExtension[]
  /** Replaces the standard set of Tiptap extensions entirely. */
  baseExtensions?: AnyExtension[]
  labels?: Partial<RichTextLabels>
  /** Hands over the Tiptap editor once it exists, for anything this component does not offer. */
  onReady?: (editor: Editor) => void
  /** Ids of the elements that label and describe the editor. */
  'aria-labelledby'?: string
  'aria-describedby'?: string
  className?: string
}

const Icon = ({ path }: { path: string }) => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" dangerouslySetInnerHTML={{ __html: path }} />
)

/** The editor on its own, without a label. Use it to build a field for a UI library of your choice. */
export function RichTextEditor(p: RichTextEditorProps) {
  const labels = { ...defaultRichTextLabels, ...p.labels }
  const items = useMemo(() => ({ ...toolbarItems, ...p.items }), [p.items])
  const names = p.toolbar ?? DEFAULT_TOOLBAR
  const [link, setLink] = useState<string | null>(null)
  // What this editor last sent out, raw and as the form stores it, so its own changes are not fed back in.
  const sent = useRef<string[]>([])
  const latest = useRef(p)
  latest.current = p

  const attributes = (q: RichTextEditorProps): Record<string, string> => ({
    ...(q.id ? { id: q.id } : {}),
    role: 'textbox',
    'aria-multiline': 'true',
    ...(q['aria-labelledby'] ? { 'aria-labelledby': q['aria-labelledby'] } : {}),
    ...(q['aria-describedby'] ? { 'aria-describedby': q['aria-describedby'] } : {}),
    ...(q.invalid ? { 'aria-invalid': 'true' } : {}),
    ...(q.required ? { 'aria-required': 'true' } : {}),
    class: 'fx-richtext-content',
  })

  const editor = useEditor({
    extensions: [
      ...(p.baseExtensions ?? [StarterKit.configure({ heading: { levels: [2, 3] }, link: { openOnClick: false, autolink: true, defaultProtocol: 'https' } })]),
      Placeholder.configure({ placeholder: () => latest.current.placeholder ?? '' }),
      ...(p.extensions ?? []),
    ],
    content: p.value || '',
    editable: !p.disabled,
    // Rendering waits for the browser, so the editor is safe to use with server rendering.
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    editorProps: { attributes: attributes(p) },
    onUpdate: ({ editor: e }) => {
      const html = e.isEmpty ? '' : e.getHTML()
      sent.current = [html, sanitizeHtml(html)]
      latest.current.onChange(html)
    },
    onBlur: () => latest.current.onBlur?.(),
  })

  useEffect(() => {
    if (!editor) return
    const value = p.value || ''
    const current = editor.isEmpty ? '' : editor.getHTML()
    // Only a change from outside (a reset, a restored draft) replaces what is in the editor.
    if (value !== current && !sent.current.includes(value) && sanitizeHtml(current) !== value) editor.commands.setContent(value, { emitUpdate: false })
  }, [editor, p.value])

  useEffect(() => {
    if (editor) latest.current.onReady?.(editor)
  }, [editor])

  useEffect(() => {
    editor?.setEditable(!p.disabled, false)
  }, [editor, p.disabled])

  useEffect(() => {
    editor?.setOptions({ editorProps: { attributes: attributes(p) } })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, p.id, p.invalid, p.required, p['aria-labelledby'], p['aria-describedby']])

  const applyLink = (e: Editor, href: string) => {
    const address = href.trim()
    if (!address) e.chain().focus().extendMarkRange('link').unsetLink().run()
    else {
      const href = /^([a-z]+:|[/#?])/i.test(address) ? address : `https://${address}`
      // With nothing selected there is no text to turn into a link, so the address itself is added.
      if (e.state.selection.empty && !e.isActive('link')) e.chain().focus().insertContent({ type: 'text', text: address, marks: [{ type: 'link', attrs: { href } }] }).run()
      else e.chain().focus().extendMarkRange('link').setLink({ href }).run()
    }
    setLink(null)
  }

  return (
    <div className={['fx-richtext', p.invalid && 'fx-richtext-invalid', p.disabled && 'fx-richtext-disabled', p.className].filter(Boolean).join(' ')}>
      {names.length > 0 && (
        <div className="fx-richtext-toolbar" role="toolbar" aria-label={labels.toolbar}>
          {names.map((name, i) => {
            if (name === '|') return <span key={i} className="fx-richtext-gap" aria-hidden="true" />
            const item = items[name]
            if (!item) return null
            const active = !!editor && !!item.isActive?.(editor)
            const enabled = !!editor && !p.disabled && (item.isEnabled?.(editor) ?? true)
            return (
              <button
                key={name}
                type="button"
                className={active ? 'fx-richtext-button fx-richtext-button-active' : 'fx-richtext-button'}
                title={item.label}
                aria-label={item.label}
                aria-pressed={item.isActive ? active : undefined}
                disabled={!enabled}
                // Keeps the selection in the text while the button is pressed.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  if (!editor) return
                  if (name === 'link') setLink(link === null ? ((editor.getAttributes('link').href as string | undefined) ?? '') : null)
                  else item.run(editor)
                }}
              >
                <Icon path={item.icon} />
              </button>
            )
          })}
        </div>
      )}
      {link !== null && editor && (
        <div className="fx-richtext-link">
          <input
            className="fx-input"
            type="url"
            autoFocus
            aria-label={labels.linkAddress}
            placeholder="https://"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                applyLink(editor, link)
              }
              if (e.key === 'Escape') {
                setLink(null)
                editor.commands.focus()
              }
            }}
          />
          <button type="button" className="fx-button" onClick={() => applyLink(editor, link)}>
            {labels.applyLink}
          </button>
          {editor.isActive('link') && (
            <button type="button" className="fx-button" onClick={() => applyLink(editor, '')}>
              {labels.removeLink}
            </button>
          )}
        </div>
      )}
      <EditorContent editor={editor} />
    </div>
  )
}

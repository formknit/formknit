import type { Editor } from '@tiptap/react'

/** One toolbar button. Add your own by passing `items` to `createRichTextField`. */
export interface ToolbarItem {
  /** Text for screen readers and the tooltip. */
  label: string
  /** The inside of a 24×24 SVG icon, drawn with strokes. */
  icon: string
  run(editor: Editor): void
  /** Whether the button shows as pressed, e.g. the cursor is in bold text. */
  isActive?(editor: Editor): boolean
  /** Whether the button can be used right now. */
  isEnabled?(editor: Editor): boolean
}

const mark = (name: string, label: string, icon: string, toggle: (e: Editor) => void): ToolbarItem => ({
  label,
  icon,
  run: toggle,
  isActive: (e) => e.isActive(name),
})

/** The built-in buttons. `link` is handled by the editor itself because it needs an address box. */
export const toolbarItems: Record<string, ToolbarItem> = {
  bold: mark('bold', 'Bold', '<path d="M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z"/>', (e) => e.chain().focus().toggleBold().run()),
  italic: mark('italic', 'Italic', '<path d="M10 5h8M6 19h8M14 5l-4 14"/>', (e) => e.chain().focus().toggleItalic().run()),
  underline: mark('underline', 'Underline', '<path d="M7 4v7a5 5 0 0 0 10 0V4M5 20h14"/>', (e) => e.chain().focus().toggleUnderline().run()),
  strike: mark('strike', 'Strikethrough', '<path d="M4 12h16M16 7a4 3 0 0 0-8 0c0 2 2 3 4 3M8 17a4 3 0 0 0 8 0"/>', (e) => e.chain().focus().toggleStrike().run()),
  code: mark('code', 'Code', '<path d="M8 7l-5 5 5 5M16 7l5 5-5 5"/>', (e) => e.chain().focus().toggleCode().run()),
  h2: {
    label: 'Heading',
    icon: '<path d="M4 5v14M12 5v14M4 12h8M16 11a2 2 0 1 1 3.6 1.2L16 17h4"/>',
    run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(),
    isActive: (e) => e.isActive('heading', { level: 2 }),
  },
  h3: {
    label: 'Subheading',
    icon: '<path d="M4 5v14M12 5v14M4 12h8M16 10.5a2 2 0 1 1 2 2.5 2 2 0 1 1-2 2.5"/>',
    run: (e) => e.chain().focus().toggleHeading({ level: 3 }).run(),
    isActive: (e) => e.isActive('heading', { level: 3 }),
  },
  bulletList: mark('bulletList', 'Bulleted list', '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>', (e) =>
    e.chain().focus().toggleBulletList().run(),
  ),
  orderedList: mark('orderedList', 'Numbered list', '<path d="M10 6h10M10 12h10M10 18h10M4 4.5l1.5-.5v4M4 14.5a1.2 1.2 0 1 1 2 .9L4 18h2.5"/>', (e) => e.chain().focus().toggleOrderedList().run()),
  blockquote: mark('blockquote', 'Quote', '<path d="M5 17V9a4 4 0 0 1 4-4M14 17V9a4 4 0 0 1 4-4M5 13h4v4H5zM14 13h4v4h-4z"/>', (e) => e.chain().focus().toggleBlockquote().run()),
  codeBlock: mark('codeBlock', 'Code block', '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M10 9l-3 3 3 3M14 9l3 3-3 3"/>', (e) => e.chain().focus().toggleCodeBlock().run()),
  rule: { label: 'Divider line', icon: '<path d="M4 12h16"/>', run: (e) => e.chain().focus().setHorizontalRule().run() },
  link: {
    label: 'Link',
    icon: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    run: () => {},
    isActive: (e) => e.isActive('link'),
  },
  clear: { label: 'Remove formatting', icon: '<path d="M6 5h12M12 5v6M8 19h8M5 21L19 7"/>', run: (e) => e.chain().focus().unsetAllMarks().clearNodes().run() },
  undo: { label: 'Undo', icon: '<path d="M8 6L4 10l4 4M4 10h10a5 5 0 0 1 0 10h-3"/>', run: (e) => e.chain().focus().undo().run(), isEnabled: (e) => e.can().undo() },
  redo: { label: 'Redo', icon: '<path d="M16 6l4 4-4 4M20 10H10a5 5 0 0 0 0 10h3"/>', run: (e) => e.chain().focus().redo().run(), isEnabled: (e) => e.can().redo() },
}

/** Shown when neither the field nor `createRichTextField` asks for particular buttons. `|` is a gap. */
export const DEFAULT_TOOLBAR = ['bold', 'italic', 'underline', '|', 'h2', 'h3', '|', 'bulletList', 'orderedList', 'blockquote', '|', 'link', '|', 'undo', 'redo']

/** Accepts `['bold', 'link']` or `"bold, link"`, which is how the visual builder stores it. */
export function parseToolbar(value: unknown): string[] | undefined {
  const list = Array.isArray(value) ? value.map(String) : typeof value === 'string' ? value.split(/[\s,]+/) : undefined
  const names = list?.map((n) => n.trim()).filter(Boolean)
  return names?.length ? names : undefined
}

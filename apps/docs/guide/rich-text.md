# Rich text

The `richText` field stores formatted text as HTML. The core package knows the field type and
keeps its value safe; the editor itself lives in a separate package, so forms that do not need
one do not pay for it.

```bash
npm install @formknit/richtext
```

```tsx
import { form, richText } from '@formknit/core'
import { Form } from '@formknit/react'
import { withRichText } from '@formknit/richtext'
import '@formknit/react/styles.css'
import '@formknit/richtext/styles.css'

const schema = form('Post', [richText('body').label('Body').required().maxLength(2000)])
const components = withRichText()          // create once, outside the component

<Form schema={schema} components={components} onSubmit={save} />
```

`withRichText()` also wraps an adapter: `withRichText(muiAdapter)`. Pass the same `components`
to `<FormBuilder>` so its previews show the editor.

The editor is [Tiptap](https://tiptap.dev) (MIT licence), which is built on ProseMirror.

Without `@formknit/richtext`, a `richText` field falls back to a plain text box and logs a
warning. Editing in the fallback drops existing formatting.

## What is stored

HTML, cleaned every time it is read, in the browser and again in `validate` on the server.
Only these tags survive: `p br strong b em i u s code pre h1 h2 h3 h4 ul ol li blockquote a hr`.
Attributes are removed, except a link's address, which must be a web address, an email, a phone
number or a path on the same site. Scripts, styles and event handlers are dropped.

- `required` treats an editor with nothing typed as empty
- `minLength` and `maxLength` count the words a person sees, not the markup

To show a stored value:

```tsx
import { RichTextView } from '@formknit/richtext'
<RichTextView html={submission.body} />
```

`sanitizeHtml(html)` and `htmlToText(html)` from `@formknit/core` do the same work without React,
for emails, exports and search.

## Choosing the toolbar

A field can name its own buttons. The visual builder has a "Toolbar buttons" setting that
writes the same thing.

```ts
richText('summary').set({ toolbar: 'bold, italic, link' })
richText('notes').set({ toolbar: ['bold', '|', 'bulletList', 'orderedList'] })
```

To set the buttons for every field that does not choose, and for anything else:

```tsx
const components = withRichText(undefined, {
  toolbar: ['bold', 'italic', '|', 'link'],      // [] hides the toolbar
  labels: { toolbar: 'Formatting', linkAddress: 'Link address' },
})
```

Built-in buttons: `bold italic underline strike code h2 h3 bulletList orderedList blockquote
codeBlock rule link clear undo redo`. `|` leaves a gap.

## Adding your own button

```tsx
const components = withRichText(undefined, {
  toolbar: ['bold', 'italic', 'today'],
  items: {
    today: {
      label: 'Insert today\'s date',
      icon: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18"/>',  // inside of a 24×24 icon
      run: (editor) => editor.chain().focus().insertContent(new Date().toLocaleDateString()).run(),
    },
  },
})
```

`run`, `isActive` and `isEnabled` receive the Tiptap editor, so anything Tiptap can do is available.

## Adding Tiptap extensions

```tsx
import Highlight from '@tiptap/extension-highlight'

const components = withRichText(undefined, {
  extensions: [Highlight],                 // added to the standard set
  // baseExtensions: [...]                 // or replace the standard set entirely
  onReady: (editor) => { /* the Tiptap editor of each field */ },
})
```

An extension that produces a tag outside the list above needs the server to accept it too.
Redefine the field with a wider list, in the browser and on the server:

```ts
import { defineField, getField, htmlToText, sanitizeHtml, RICH_TEXT_TAGS } from '@formknit/core'

const tags = [...RICH_TEXT_TAGS, 'mark']
defineField({ ...getField('richText')!, coerce: (v) => {
  const html = sanitizeHtml(String(v ?? ''), { tags })
  return htmlToText(html) ? html : ''
} })
```

Only tags can be added this way. Attributes other than a link's address are always removed.

## Using a different editor

Nothing ties the field to Tiptap. A `richText` component is an ordinary field component: it
receives the stored HTML as `value` and calls `onChange` with new HTML. Whatever it sends is
cleaned by the core, so a different editor cannot store anything unsafe.

```tsx
import type { FieldProps } from '@formknit/react'

function MyEditorField(p: FieldProps<string>) {
  return (
    <div className="fx-field">
      <div className="fx-label">{p.label}</div>
      <MyEditor html={p.value} onHtmlChange={p.onChange} onBlur={p.onBlur} readOnly={p.disabled} />
      {p.error && <div className="fx-error">{p.error}</div>}
    </div>
  )
}

<Form schema={schema} components={{ fields: { richText: MyEditorField } }} />
```

To keep Tiptap but supply your own label and layout (for a UI library, say), use the bare
`RichTextEditor` component, which takes `value`, `onChange`, `toolbar`, `items`, `extensions`,
`placeholder`, `disabled` and `invalid`.

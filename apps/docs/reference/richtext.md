# @formknit/richtext

[[toc]]

A rich text editor field built on [Tiptap](https://tiptap.dev).

```bash
npm install @formknit/richtext
```

```ts
import '@formknit/richtext/styles.css'
```

## Exports

| Export | |
|---|---|
| `withRichText(adapter?, options?)` | Returns the components with `richText` set to the editor |
| `createRichTextField(options?)` | The field component on its own |
| `RichTextField` | The field with the standard toolbar |
| `RichTextEditor` | The editor without a label, for your own field components |
| `RichTextView` | Shows stored HTML safely |
| `toolbarItems` | The built-in buttons, by name |
| `DEFAULT_TOOLBAR` | The standard button order |
| `parseToolbar(value)` | Reads `"bold, italic"` or `['bold']` into a list |
| `defaultRichTextLabels` | English text for the toolbar and link box |

## Options

`withRichText` and `createRichTextField` take:

| Option | |
|---|---|
| `toolbar` | Button names in order; `\|` is a gap; `[]` hides the toolbar |
| `items` | Extra or replacement buttons: `{ label, icon, run(editor), isActive?(editor), isEnabled?(editor) }` |
| `extensions` | Tiptap extensions added to the standard set |
| `baseExtensions` | Replaces the standard set |
| `labels` | `toolbar`, `linkAddress`, `applyLink`, `removeLink` |
| `onReady(editor)` | Receives each field's Tiptap editor |

A field's own `toolbar` property wins over the `toolbar` option.

## RichTextEditor props

`value`, `onChange`, `onBlur`, `id`, `placeholder`, `disabled`, `invalid`, `required`,
`toolbar`, `items`, `extensions`, `baseExtensions`, `labels`, `onReady`,
`aria-labelledby`, `aria-describedby`, `className`.

## Toolbar buttons

`bold`, `italic`, `underline`, `strike`, `code`, `h2`, `h3`, `bulletList`, `orderedList`,
`blockquote`, `codeBlock`, `rule`, `link`, `clear`, `undo`, `redo`.

See [rich text](/guide/rich-text) for examples.

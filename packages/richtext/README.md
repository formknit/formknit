# @formknit/richtext

A rich text editor field for [Formknit](https://github.com/formknit/formknit) forms, built on
[Tiptap](https://tiptap.dev). The toolbar, the buttons and the Tiptap extensions are all
configurable, and the stored HTML is cleaned by `@formknit/core` in the browser and on the server.

```bash
npm install @formknit/core @formknit/react @formknit/richtext
```

```tsx
import { form, richText } from '@formknit/core'
import { Form } from '@formknit/react'
import { withRichText } from '@formknit/richtext'
import '@formknit/react/styles.css'
import '@formknit/richtext/styles.css'

const schema = form('Post', [richText('body').label('Body').required()])
const components = withRichText(undefined, { toolbar: ['bold', 'italic', '|', 'bulletList', 'link'] })

export const PostForm = () => <Form schema={schema} components={components} onSubmit={console.log} />
```

| Export | |
|---|---|
| `withRichText(adapter?, options?)` | Adds the editor to the built-in components or to an adapter |
| `createRichTextField(options)` | The field component on its own |
| `RichTextEditor` | The editor without a label, for building your own field |
| `RichTextView` | Shows stored rich text safely |
| `toolbarItems`, `DEFAULT_TOOLBAR` | The built-in buttons |

Options: `toolbar`, `items` (your own buttons), `extensions`, `baseExtensions`, `labels`, `onReady`.

See the rich text guide in the documentation for the full list of buttons, custom extensions and
how to use a different editor.

MIT licence.

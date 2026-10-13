# @formknit/builder

A drag-and-drop form builder for [Formknit](https://github.com/formknit/formknit). It edits a
form schema, which is plain JSON you can store anywhere and render with `@formknit/react`.

```bash
npm install @formknit/core @formknit/react @formknit/builder
```

```tsx
import { FormBuilder } from '@formknit/builder'
import '@formknit/react/styles.css'
import '@formknit/builder/styles.css'

export function Editor({ initial, save }) {
  return <FormBuilder defaultValue={initial} onChange={save} />
}
```

- Drag fields from the palette, reorder them, nest them in panels, columns and repeating groups
- Settings for every field: labels, validation, widths, options, conditions and formulas
- A rule builder for conditions and a formula editor with suggestions
- Multi-page forms, undo and redo, live preview and a JSON view
- Works with touch and with the keyboard
- Shows your own field types, with their own icons and settings, through `registerBuilderField`
- Previews use the same components as your forms: pass `components`

| Prop | |
|---|---|
| `defaultValue` | The schema to start from |
| `value`, `onChange` | Control the schema yourself |
| `components` | Field components or an adapter, for the previews |

Full documentation is in the repository.

MIT licence.

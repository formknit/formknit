# Visual builder

`@formknit/builder` lets people design forms by drag and drop. It produces the same schema you
would write by hand.

```bash
npm install @formknit/builder
```

```tsx
import { FormBuilder } from '@formknit/builder'
import '@formknit/react/styles.css'
import '@formknit/builder/styles.css'

function Editor() {
  const [schema, setSchema] = useState(initialSchema)
  return (
    <div style={{ height: '100vh' }}>
      <FormBuilder value={schema} onChange={setSchema} />
    </div>
  )
}
```

Give it a container with a height; it fills it. Save `schema` wherever you keep forms.

| Prop | |
|---|---|
| `value`, `onChange` | Controlled: you hold the schema |
| `defaultValue` | Uncontrolled: the builder holds it, and still calls `onChange` |
| `components` | The same adapter your forms use, so previews match |

## What it does

- **Palette.** Every field type, including your [custom ones](./custom-fields). Drag onto the
  canvas, or click to add after the selected field.
- **Canvas.** Each field is a card with a live preview. Drop into panels, columns and repeating
  groups. Move, duplicate and delete with the buttons on the selected card, or the keyboard.
- **Settings.** Display, Validation and Logic tabs, generated for each field type.
- **Keys.** A field's key follows its label ("Full name" becomes `fullName`) until you edit the
  key yourself. Renaming a key updates every formula that uses it.
- **Rules.** "Show this field when" is built from rows of field, comparison and value, combined
  with all or any, with one level of grouping. Switch to typing a formula for anything more.
- **Formulas.** Calculated fields get an editor with a live syntax check and buttons to insert
  fields and functions.
- **Pages.** Add, rename, reorder and delete steps, and show a step conditionally.
- **Appearance.** Size, field style, label position and theme, stored in the schema.
- **Undo and redo**, with Ctrl/Cmd+Z. A burst of typing is one step.
- **Preview** runs the real form with live data. **JSON** shows the schema and accepts edits.
- **Problems.** Schema mistakes are listed as you work.

## Touch

On phones and tablets, tap a palette item to add it, and drag a card by its grip handle.

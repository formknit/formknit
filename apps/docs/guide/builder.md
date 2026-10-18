# Embedding the builder

[[toc]]

## Introduction

`@formknit/builder` is a drag-and-drop form designer you can put inside your own application,
so the people who own a form can change it without a developer. It edits a
[schema](./concepts#the-schema), the same JSON you would write by hand, and you decide where
it is stored.

## Installation

```bash
npm install @formknit/builder
```

```ts
import '@formknit/react/styles.css'
import '@formknit/builder/styles.css'
```

## Usage

```tsx
import { FormBuilder } from '@formknit/builder'

function FormEditor({ initial, onSave }: { initial: FormSchema; onSave: (s: FormSchema) => void }) {
  const [schema, setSchema] = useState(initial)
  return (
    <div style={{ height: '100vh' }}>
      <FormBuilder value={schema} onChange={setSchema} />
      <button onClick={() => onSave(schema)}>Save</button>
    </div>
  )
}
```

The builder fills its container, so give the container a height.

### Props

| Prop | |
|---|---|
| `value` + `onChange` | Controlled: you hold the schema and receive a new object after every edit |
| `defaultValue` | Uncontrolled: the builder holds the schema, starting from this. `onChange` is still called |
| `components` | The adapter your forms use, so previews look the same; see [adapters](./adapters) |
| `className` | Added to the builder's root element |

With neither `value` nor `defaultValue`, the builder starts from an empty one-page form
(`emptySchema()`).

`onChange` receives a **new object** each time, never a mutated one, so it works directly with
React state, undo libraries and change detection.

## Saving

The builder never saves anything itself. Common patterns:

```tsx
// save after people stop editing for a second
const save = useMemo(() => debounce((s: FormSchema) => api.saveForm(id, s), 1000), [id])
<FormBuilder defaultValue={stored} onChange={save} />
```

```ts
// check before publishing
import { checkSchema } from '@formknit/core'
const problems = checkSchema(schema).filter((i) => i.level === 'error')
if (problems.length) showErrors(problems)
```

Keep a copy of each published version alongside your submissions, so old answers can be read
with the form they were given against.

## What people can do

**Palette.** Every field type is listed by group, including your
[custom ones](./builder-extending). Drag one onto the canvas, or click it to add it after the
selected field.

**Canvas.** Each field is a card with a live preview. Fields can be dropped into panels,
columns and repeating groups, and moved with drag and drop, with the buttons on the selected
card, or with the keyboard.

**Settings.** The selected field's settings are split into Display, Validation and Logic tabs
and are generated for each field type: options for a select, a formula editor for a
calculated field, columns for a column layout, and so on.

**Keys.** A field's key follows its label ("Full name" becomes `fullName`) until someone edits
the key. Renaming a key updates every formula that uses it.

**Conditions.** "Show this field when" is built from rows of field, comparison and value,
combined with *all* or *any*, with one level of grouping. Anything more complex can be typed as
a formula, and simple formulas are turned back into rows.

**Formulas.** Calculated fields get an editor with a live syntax check and buttons to insert
fields and functions.

**Pages.** Add, rename, reorder and delete pages, and show a page conditionally.

**Appearance.** Size, field style, label position and theme, stored in the schema.

**Preview and JSON.** Preview runs the real form with live validation. The JSON view shows the
schema and accepts pasted edits.

**Problems.** Mistakes such as duplicate keys or circular formulas are listed as people work.

## Keyboard and touch

| Keys | |
|---|---|
| `Tab` | Move between cards and controls |
| `Enter` or `Space` on a card | Select it |
| `Delete` or `Backspace` on a card | Delete it |
| `Ctrl/Cmd + Z`, `Ctrl/Cmd + Shift + Z` | Undo and redo, when focus is not in a text box. A burst of typing is one step |

On phones and tablets, tap a palette item to add it, and drag a card by its grip handle.

## Letting end users build forms

The builder is the same whether it is used by your team or your customers. Two things to
keep in mind when strangers can edit forms:

- Schemas are safe to render: formulas never run as JavaScript, and rich text is cleaned.
- Validate each schema with `checkSchema` when you store it, and limit its size on your API.

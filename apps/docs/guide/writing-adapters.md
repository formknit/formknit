# Writing an adapter

[[toc]]

## Introduction

An adapter is an object of React components. You can write a complete one for a design
system, or just the few components you want to change. This page lists what each component
receives.

```ts
import type { PartialAdapter } from '@formknit/react'

export const myAdapter: PartialAdapter = {
  fields: { text: MyInput, email: MyInput, select: MySelect },
  layout: { panel: MyCard },
  ui: { Button: MyButton },
}
```

## Field components

Every field component receives `FieldProps` and is responsible for the label, the control,
the help text and the error:

```tsx
import type { FieldProps } from '@formknit/react'

export function MyInput(p: FieldProps<string>) {
  const describedBy = [p.description && `${p.id}-desc`, p.error && `${p.id}-err`].filter(Boolean).join(' ')
  return (
    <div className="field">
      <label htmlFor={p.id}>
        {p.label}
        {p.required && <span aria-hidden> *</span>}
      </label>
      <input
        id={p.id}
        name={p.path}
        value={p.value ?? ''}
        placeholder={p.placeholder}
        disabled={p.disabled}
        required={p.required}
        aria-invalid={!!p.error}
        aria-describedby={describedBy || undefined}
        onChange={(e) => p.onChange(e.target.value)}
        onBlur={p.onBlur}
      />
      {p.description && <small id={`${p.id}-desc`}>{p.description}</small>}
      <span id={`${p.id}-err`} role="alert">{p.error}</span>
    </div>
  )
}
```

| Prop | |
|---|---|
| `id` | A unique id for the control. Point the label's `htmlFor` at it |
| `path` | The field's location in the data, e.g. `items.0.qty` |
| `component` | The field's schema, for type-specific settings (`rows`, `accept`, custom ones) |
| `label`, `description`, `placeholder` | Display text |
| `options` | Choices, as `[{ label, value }]` |
| `value` | The current value |
| `onChange(value)` | Report a new value. Pass typed text through unchanged; Formknit converts it |
| `onBlur()` | Call when the person leaves the field, so its error may be shown |
| `error` | The message to show now, or `undefined` |
| `required`, `disabled` | State |
| `loading` | A lookup is fetching, or a file is uploading |

### Values by field type

Your component must produce values in the shape the field type stores; see
[field types](./fields). Formknit normalises what it can (number text to numbers, for
example), but a date field must still produce `YYYY-MM-DD` text, a checkbox group a list
of values, and so on.

### Accessibility checklist

- The label is tied to the control (`htmlFor`/`id`), or choices are grouped in a `fieldset`
  with a `legend`.
- Help text and errors are linked with `aria-describedby`.
- Invalid controls have `aria-invalid`.
- Everything works with the keyboard.

## Layout components

| Component | Props |
|---|---|
| `panel` | `component` (its schema, with `label`), `children` |
| `columns` | `component`, `columns: [{ width, children }]` (`width` is relative) |
| `content` | `component` (with `content` and `heading`) |
| `divider` | `component` |
| `repeater` | see below |

Unknown layout types fall back to `panel`, so custom layout types render sensibly.

### Repeater

```ts
interface RepeaterProps {
  id: string
  path: string
  component: ComponentSchema
  label?: string
  description?: string
  rows: { index, path, children, remove, moveUp?, moveDown? }[]
  add?: () => void          // undefined when the list is full or disabled
  error?: string
  required: boolean
  disabled: boolean
  labels: Labels            // translated button text
}
```

Render each row's `children` (its fields, already laid out) with your own remove and move
buttons. `moveUp` is `undefined` on the first row and `moveDown` on the last.

## UI components

| Component | Props |
|---|---|
| `Button` | `type` (`button` or `submit`), `variant` (`primary` or `secondary`), `disabled`, `onClick`, `children` |
| `Steps` | `pages: [{ index, key, title, valid }]`, `step` (current position) |

`Steps` is only rendered for multi-page forms.

## Testing your adapter

Render a form with every field type and run an accessibility checker such as `axe-core`
over it; Formknit's own tests do exactly that. `describeAdapter` lists what falls back to
the built-in look.

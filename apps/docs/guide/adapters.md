# UI library adapters

Formknit keeps a form's logic separate from its looks. An adapter is a map from each field
type to the component that draws it. Pass one to `<Form>` and the same schema renders with a
different UI library.

## Material UI

```bash
npm install @formknit/adapter-mui @mui/material @emotion/react @emotion/styled
```

```tsx
import { muiAdapter } from '@formknit/adapter-mui'
import '@formknit/react/styles.css'

<Form schema={schema} components={muiAdapter} />
```

It follows your MUI theme and needs Material UI 6 or later.

## shadcn/ui

shadcn components live in your project, so the adapter does too. Copy
`packages/adapter-shadcn/registry/formknit.tsx` into your project as `components/formknit.tsx`,
add the components it imports, and use it:

```bash
npx shadcn@latest add button checkbox input label radio-group select slider switch textarea
```

```tsx
import { shadcnAdapter } from '@/components/formknit'
<Form schema={schema} components={shadcnAdapter} />
```

::: warning Check it in your project
The shadcn adapter is tested against stand-ins with the same props as the shadcn components.
It has not been run inside a real Tailwind and shadcn project yet.
:::

## Replacing one field

You do not need a whole adapter to change one thing. Anything you leave out falls back to the
built-in skin:

```tsx
<Form schema={schema} components={{ fields: { date: MyDatePicker } }} />
<Form schema={schema} components={{ ...muiAdapter, fields: { ...muiAdapter.fields, date: MyDatePicker } }} />
```

## Writing a field component

A field component receives `FieldProps` and renders the label, control, help text and error:

```tsx
import type { FieldProps } from '@formknit/react'

function MyTextField(p: FieldProps<string>) {
  return (
    <div>
      <label htmlFor={p.id}>{p.label}{p.required && ' *'}</label>
      <input
        id={p.id}
        value={p.value ?? ''}
        placeholder={p.placeholder}
        disabled={p.disabled}
        aria-invalid={!!p.error}
        onChange={(e) => p.onChange(e.target.value)}
        onBlur={p.onBlur}
      />
      {p.description && <small>{p.description}</small>}
      {p.error && <span role="alert">{p.error}</span>}
    </div>
  )
}
```

| Prop | |
|---|---|
| `id`, `path` | An id for the control, and the field's location in the data (`items.0.qty`) |
| `component` | The field's schema, for any extra properties |
| `label`, `description`, `placeholder`, `options` | Display text and choices |
| `value`, `onChange(value)` | Pass typed text through unchanged; Formknit converts numbers itself |
| `onBlur()` | Call when the user leaves the field, so its error may be shown |
| `error` | The message to show now, or `undefined` |
| `required`, `disabled`, `loading` | State |

An adapter has three groups: `fields` (by field type), `layout` (`panel`, `columns`, `content`,
`divider`, `repeater`) and `ui` (`Button`, `Steps`). See the Material UI adapter's source for
a complete example.

## Checking coverage

```ts
import { describeAdapter } from '@formknit/react'
describeAdapter(myAdapter) // { own: [...], fallback: [...], missing: [...] }
```

`fallback` lists the types drawn by the built-in skin, and `missing` any custom types with no
component at all.

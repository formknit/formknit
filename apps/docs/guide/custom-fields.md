# Custom field types

A field type has up to three parts. Only the first two are needed to use it in a form.

## 1. Tell the core about it

```ts
import { defineField } from '@formknit/core'

defineField({
  type: 'colour',
  kind: 'input',
  label: 'Colour',
  group: 'Basic',            // palette group in the builder
  emptyValue: '',
  coerce: (v) => (typeof v === 'string' ? v.toLowerCase() : ''),
  check: (value, component, label) => (/^#[0-9a-f]{6}$/.test(String(value)) ? null : `${label} must be a colour like #1a2b3c`),
})
```

| Property | |
|---|---|
| `kind` | `input` (holds a value), `calculated`, `repeater`, `layout` or `content` |
| `emptyValue` | Submitted when the field is left empty |
| `coerce(value)` | Tidies a raw value before validation |
| `isEmpty(value)` | Overrides what "empty" means for `required` |
| `check(value, component, label, messages)` | Returns an error message, or `null` |
| `requiredMessage(label, messages)` | Replaces "… is required" |

Run this on the server too, so `validate` knows the type.

## 2. Give it a component

```tsx
import type { FieldProps } from '@formknit/react'

function ColourField(p: FieldProps<string>) {
  return (
    <div className="fx-field">
      <label className="fx-label" htmlFor={p.id}>{p.label}</label>
      <input id={p.id} type="color" value={p.value || '#000000'} onChange={(e) => p.onChange(e.target.value)} onBlur={p.onBlur} />
      {p.error && <div className="fx-error">{p.error}</div>}
    </div>
  )
}

<Form schema={schema} components={{ fields: { colour: ColourField } }} />
```

Use it in a form with the generic builder, giving the value type:

```ts
import { field } from '@formknit/core'
field<'brand', string>('colour', 'brand', { label: 'Brand colour' })
```

## 3. Show it in the visual builder

It appears in the palette as soon as it is defined. To give it an icon, starting properties
and its own settings:

```ts
import { registerBuilderField } from '@formknit/builder'

registerBuilderField('colour', {
  icon: '<circle cx="12" cy="12" r="9"/>',   // inner SVG for a 24x24 line icon
  defaults: () => ({ label: 'Colour' }),
  settings: [{ path: 'palette', label: 'Palette name', input: 'text', tab: 'display' }],
})
```

Pass the same `components` to `<FormBuilder>` so its previews use your component.

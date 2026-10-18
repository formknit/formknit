# Extending the builder

[[toc]]

## Introduction

The builder discovers field types from the core's registry, so a
[custom field type](./custom-fields) appears in the palette as soon as it is defined. This
page shows how to give it an icon, sensible defaults and its own settings, and how to reuse
the builder's rule editor elsewhere.

## Registering a field

```ts
import { registerBuilderField } from '@formknit/builder'

registerBuilderField('colour', {
  icon: '<circle cx="12" cy="12" r="9"/><path d="M12 3v18"/>',
  defaults: () => ({ label: 'Colour', defaultValue: '#4f46e5' }),
  settings: [
    { path: 'palette', label: 'Palette', input: 'select', tab: 'display',
      choices: [{ label: 'Brand', value: 'brand' }, { label: 'Any colour', value: '' }] },
    { path: 'allowTransparent', label: 'Allow transparent', input: 'checkbox', tab: 'validation' },
  ],
})
```

| Option | |
|---|---|
| `icon` | The inside of a 24×24 SVG drawn with strokes, like the built-in icons |
| `defaults()` | Properties a newly added field starts with |
| `settings` | Extra settings, shown after the common ones (label, key, help text…) |

Call it once, when your app starts, before the builder renders. Registering a built-in type
replaces its builder settings.

## Settings

Each setting edits one property of the component, by path:

| Property | |
|---|---|
| `path` | The property to edit, e.g. `palette` or `validate.max` |
| `label` | Shown next to the control |
| `input` | The kind of control; see below |
| `tab` | `display`, `validation` or `logic` |
| `help` | A hint under the control |
| `choices` | For `select`: `[{ label, value }]`. An empty value removes the property |

| `input` | Edits |
|---|---|
| `text`, `textarea`, `number`, `checkbox`, `select` | A plain value |
| `options` | A list of choices (`options`) |
| `expression` | A condition, with a syntax check |
| `rules` | A condition built from rows of field, comparison and value |
| `formula` | A formula, with field and function buttons |
| `columns` | The columns of a column layout |
| `key` | A field key, with the uniqueness check and renaming |

## Previews

The canvas renders each card with the components you pass in the builder's `components`
prop. Give your custom type a component there, the same one your forms use:

```tsx
<FormBuilder value={schema} onChange={setSchema} components={{ fields: { colour: ColourField } }} />
```

## The rule editor's model

The builder converts between formulas and editable rule rows with two exported functions.
Use them to build your own condition editor:

```ts
import { fromExpression, toExpression } from '@formknit/builder'

fromExpression('country == "NP" AND age >= 18')
// { mode: 'all', rules: [
//   { field: 'country', op: 'eq', value: 'NP' },
//   { field: 'age', op: 'gte', value: '18' } ] }

toExpression({ mode: 'any', rules: [{ field: 'plan', op: 'eq', value: 'pro' }, { field: 'trial', op: 'checked', value: '' }] })
// 'plan == "pro" OR trial == true'
```

Operators: `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `contains`, `empty`, `notEmpty`, `checked`,
`unchecked`. `fromExpression` returns `null` when a formula is too complex for rows; show it
as text in that case.

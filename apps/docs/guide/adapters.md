# Adapters

[[toc]]

## Introduction

Formknit keeps what a form **does** separate from how it **looks**. The logic lives in the
core; the looks come from an **adapter**: a map from each field type to the React component
that draws it.

```tsx
<Form schema={schema} />                              // the built-in look
<Form schema={schema} components={muiAdapter} />      // Material UI
<Form schema={schema} components={shadcnAdapter} />   // shadcn/ui
```

The same schema, the same validation, the same data: only the components change.

## Available adapters

| Adapter | Package | |
|---|---|---|
| Built-in | `@formknit/react` | Themeable with CSS variables; see [styling](./styling) |
| [Material UI](./adapter-mui) | `@formknit/adapter-mui` | Uses your MUI theme |
| [shadcn/ui](./adapter-shadcn) | `@formknit/adapter-shadcn` | A file you copy into your project |
| Rich text | `@formknit/richtext` | Adds the editor to any of the above; see [rich text](./rich-text) |

Ant Design and Chakra UI adapters are planned. Until then, [writing one](./writing-adapters)
takes an afternoon.

## Replacing a single field

You never need a whole adapter to change one thing. Anything you leave out falls back to the
built-in look:

```tsx
<Form schema={schema} components={{ fields: { date: MyDatePicker } }} />
```

Or on top of an adapter:

```tsx
const components = { ...muiAdapter, fields: { ...muiAdapter.fields, date: MyDatePicker } }
<Form schema={schema} components={components} />
```

Create such objects once, outside your component, so React does not see a new adapter on
every render.

## What an adapter contains

```ts
{
  fields: { text, number, select, … },             // by field type
  layout: { panel, columns, content, divider, repeater },
  ui: { Button, Steps },                            // buttons and the step indicator
}
```

All three groups are optional when passed to `components`. See
[writing an adapter](./writing-adapters) for the props each component receives.

## Keep the stylesheet

Import `@formknit/react/styles.css` whichever adapter you use. Besides the built-in look, it
provides the responsive grid that places fields side by side, which adapters rely on.

## Checking coverage

```ts
import { describeAdapter } from '@formknit/react'

describeAdapter(myAdapter)
// { own: ['text', 'select', …], fallback: ['signature', 'address'], missing: [] }
```

`fallback` lists the types drawn by the built-in look, and `missing` lists custom field types
with no component at all. Run it in a test to catch a new field type nobody has styled.

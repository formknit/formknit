# Defining forms

[[toc]]

## Introduction

A form is a [schema](./concepts#the-schema): plain JSON. There are three ways to make one,
and they all produce the same thing:

1. **In code**, with the builder functions on this page. Best when developers own the form,
   because you get autocompletion and the type of the submitted data.
2. **As JSON**, written by hand or stored in a database. See the
   [schema reference](./schema).
3. **In the [visual builder](./builder)**, when the people who own the form do not write code.

## Creating a form

`form()` takes a title, a list of fields (or [pages](./layout#multi-page-forms)) and optional
settings:

```ts
import { form, number, text } from '@formknit/core'

export const order = form(
  'Order',
  [
    text('customer').label('Customer').placeholder('Full name').required(),
    number('quantity').label('Quantity').min(1).max(100).default(1),
  ],
  { description: 'We deliver within three days.', submitLabel: 'Place order' },
)
```

The result is the schema itself, so you can pass it to `<Form>`, `validate()`, store it with
`JSON.stringify`, or spread it to add more properties:

```ts
const compact = { ...order, appearance: { size: 'sm' as const } }
```

## Field builders

Every field type has a builder named after it. The first argument is always the **key**: the
property name the value will have in the submitted data. Keys may use letters, digits and `_`, cannot
start with a digit, and must be unique within the form (or within a repeater row). A few words
used by formulas (`true`, `false`, `null`, `and`, `or`, `not`) cannot be keys.

```ts
text('fullName')
email('email')
number('age')
select('country', { NP: 'Nepal', IN: 'India' })
```

See [field types](./fields) for every builder and the value each produces.

## Common settings

Every builder returns an object with these chainable methods:

| Method | Effect |
|---|---|
| `.label(text)` | The field's label. Also used in error messages |
| `.placeholder(text)` | Hint shown inside an empty control |
| `.description(text)` | Help text shown under the control |
| `.default(value)` | The starting value |
| `.required()` | Must be filled in. On a checkbox, must be ticked |
| `.min(n)`, `.max(n)` | Number limits, or `YYYY-MM-DD` limits for dates |
| `.minLength(n)`, `.maxLength(n)` | Text length |
| `.pattern(regex, message?)` | The whole value must match |
| `.minItems(n)`, `.maxItems(n)` | For checkbox groups and repeaters |
| `.check(formula, message)` | A [custom rule](./validation#custom-rules) |
| `.visibleWhen(formula)` | Shown, validated and submitted only while true |
| `.requiredWhen(formula)` | Required while true |
| `.disabledWhen(formula)` | Read-only, and not validated, while true |
| `.width(n)` | Columns out of 12; see [layout](./layout#widths) |
| `.className(names)` | Extra CSS classes on the field's wrapper |
| `.set({ ... })` | Any other schema property |

`.set()` is the escape hatch for properties without a method, such as a textarea's height or
a custom field's own settings:

```ts
textarea('bio').label('About you').set({ rows: 6 })
```

::: warning `.set()` replaces whole properties
`.set({ validate: { maxSizeMb: 2 } })` replaces the entire `validate` object, including a
`required` set earlier. Call `.set()` first and the rule methods after it, or put every rule
in the object you pass.
:::

## The data type

Forms built in code know the shape of their data:

```ts
import type { InferData } from '@formknit/core'

type Order = InferData<typeof order>
// { customer: string; quantity: number | null }
```

`<Form>`'s `onSubmit` and `useForm` use this automatically. Choices become unions
(`'NP' | 'IN' | ''`), repeaters become arrays of rows, and layout components do not add
nesting.

For forms stored as JSON, generate the type with the [command-line tool](./cli).

## Writing JSON directly

The same order form as JSON:

```json
{
  "version": 1,
  "title": "Order",
  "description": "We deliver within three days.",
  "submitLabel": "Place order",
  "pages": [
    {
      "key": "main",
      "components": [
        { "type": "text", "key": "customer", "label": "Customer", "placeholder": "Full name", "validate": { "required": true } },
        { "type": "number", "key": "quantity", "label": "Quantity", "defaultValue": 1, "validate": { "min": 1, "max": 100 } }
      ]
    }
  ]
}
```

A single-page form still has one page. Every property is listed in the
[schema reference](./schema).

## Checking a schema

Mistakes in a schema (an unknown field type, a duplicate key, a formula that does not parse,
two formulas that depend on each other) are found by `checkSchema`:

```ts
import { checkSchema } from '@formknit/core'

checkSchema(schema)
// [{ level: 'error', path: 'total', message: 'Circular reference: total → tax → total' }]
```

`validate()` throws a `SchemaError` when a schema has errors, so check schemas when you save
them rather than when someone submits. The visual builder shows these problems as people work,
and `formknit check` runs it from the command line.

## Treat schemas as immutable

Formknit caches its analysis of each schema object. When a form changes, create a new object
rather than editing one in place:

```ts
const next = { ...schema, title: 'New title' }   // ✓
schema.title = 'New title'                        // ✗ the change may not be noticed
```

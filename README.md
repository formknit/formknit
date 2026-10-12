# Formknit

Open-source form engine for React developers: describe a form once as data, then
render it, validate it on the server with the same rules, and edit it in a visual
builder.

**Status: early development, nothing published yet.** See [PLAN.md](PLAN.md) for the roadmap.

## Packages

| Package | Status | What it does |
|---|---|---|
| `@formknit/core` | Working | Schema, code-first builders, validation, formulas, visibility rules. No dependencies; runs in browsers, Node and Bun |
| `@formknit/react` | Working | `<Form>`, `useForm` and `useField` hooks, multi-step forms, repeaters, swappable components, default skin |
| `@formknit/adapter-mui` | Working | Renders forms with Material UI components and your MUI theme |
| `@formknit/builder` | Working | Drag-and-drop form builder: palette, canvas, settings, rule and formula editors, pages, undo/redo, preview and JSON views |

## Quick look

```tsx
import { calculated, form, number, repeater, select, text } from '@formknit/core'
import { Form } from '@formknit/react'
import '@formknit/react/styles.css'

const invoice = form('Fee invoice', [
  select('country', { NP: 'Nepal', IN: 'India' }).label('Country').required(),
  text('district').label('District').visibleWhen('country == "NP"').required(),
  repeater('items', [
    text('name').label('Item').required(),
    number('qty').label('Qty').min(1),
    number('rate').label('Rate'),
    calculated('amount', 'qty * rate').label('Amount'),
  ]).label('Items').minItems(1),
  calculated('total', 'SUM(items.amount)').label('Total'),
])

// `data` is fully typed from the schema: data.items[0].amount is number | null
export const InvoiceForm = () => <Form schema={invoice} onSubmit={(data) => save(data)} />
```

To render with Material UI, pass the adapter:

```tsx
import { muiAdapter } from '@formknit/adapter-mui'

<Form schema={invoice} components={muiAdapter} />
```

For any other UI library, pass your own components for the field types you want to replace:

```tsx
<Form schema={invoice} components={{ fields: { text: MyTextField, select: MySelect } }} />
```

Theme the default skin with CSS variables such as `--fx-primary` and `--fx-radius`.

Let your own users design forms by embedding the builder:

```tsx
import { FormBuilder } from '@formknit/builder'
import '@formknit/react/styles.css'
import '@formknit/builder/styles.css'

<FormBuilder value={schema} onChange={setSchema} />
```

## Server validation

```ts
import { validate, type FormSchema } from '@formknit/core'

const invoice: FormSchema = {
  version: 1,
  pages: [
    {
      key: 'main',
      components: [
        { type: 'select', key: 'country', options: [{ label: 'Nepal', value: 'NP' }] },
        { type: 'text', key: 'district', visibleWhen: 'country == "NP"', validate: { required: true } },
        {
          type: 'repeater',
          key: 'items',
          components: [
            { type: 'number', key: 'qty', validate: { min: 1 } },
            { type: 'number', key: 'rate' },
            { type: 'calculated', key: 'amount', expression: 'qty * rate' },
          ],
        },
        { type: 'calculated', key: 'total', expression: 'SUM(items.amount)' },
      ],
    },
  ],
}

const result = validate(invoice, requestBody)
// result.valid   false if any rule fails
// result.errors  { 'items.0.qty': ['qty must be at least 1'] }
// result.data    cleaned: hidden and unknown fields removed, formulas recalculated
```

Other exports: `computeState` (per-field visibility, required, disabled, errors, for
renderers), `checkSchema` (finds mistakes in a schema, including circular formulas),
`getInitialValues`, `evaluate` (run one expression), `defineField` and
`registerFunction` (extend it).

## Expressions

One Excel-style language is used for `visibleWhen`, `requiredWhen`, `disabledWhen`,
calculated fields and custom validation rules.

- Operators: `+ - * / % ^`, `&` (join text), `== != > >= < <=`, `AND OR NOT`
- Functions: `SUM AVG MIN MAX COUNT ROUND FLOOR CEIL ABS NUMBER IF IFERROR AND OR NOT
  CONCAT LEN UPPER LOWER TRIM CONTAINS ISEMPTY COALESCE TODAY YEAR MONTH DAY DATEDIF`
- `items.amount` reads a column from every row of a repeater
- Hidden fields read as empty
- Errors such as `#DIV/0!` are values shown on the field; evaluation never throws
- Expressions are parsed, never run as JavaScript

## Development

Requires Node 20+ and pnpm (`corepack enable` turns it on).

```bash
pnpm install
pnpm test
pnpm typecheck
pnpm build
pnpm --filter @formknit/playground dev   # example forms at http://localhost:5173
```

## Licence

MIT

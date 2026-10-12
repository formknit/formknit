# Formknit

Open-source form engine for React developers: describe a form once as data, then
render it, validate it on the server with the same rules, and edit it in a visual
builder.

**Status: early development, nothing published yet.** See [PLAN.md](PLAN.md) for the roadmap.

## Packages

| Package | Status | What it does |
|---|---|---|
| `@formknit/core` | Working | Schema, code-first builders, validation, formulas, visibility rules. No dependencies; runs in browsers, Node and Bun |
| `@formknit/react` | Working | `<Form>`, `useForm` and `useField` hooks, multi-step forms, repeaters, lookups, uploads, drafts, swappable components, themeable responsive skin |
| `@formknit/adapter-mui` | Working | Renders forms with Material UI components and your MUI theme |
| `@formknit/adapter-shadcn` | Working, see note | One file you copy into a shadcn/ui project. Tested against stand-in components, not yet inside a real shadcn project |
| `@formknit/cli` | Working | `formknit check` lists schema problems; `formknit types` generates a TypeScript type |
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

## Styling

Import `@formknit/react/styles.css` once. Then:

| What | How |
|---|---|
| Size | `<Form size="sm" />` or `"lg"` (class `fx-size-sm`, `fx-size-lg`) |
| Field style | `variant="filled"` or `"underline"` |
| Label position | `labelPosition="left"` puts labels beside fields on wide forms |
| Dark mode | `theme="dark"`, or `"auto"` to follow the system |
| Field width | `text('city').width(4)` on a 12-column grid: 6 is half, 4 a third |
| Colours, radius, spacing | Override CSS variables such as `--fx-primary`, `--fx-radius`, `--fx-gap` |
| Helper classes | `.className('fx-hide-label')`, `fx-stack-choices`, `fx-hide-narrow`, `fx-show-narrow`, `fx-align-end` |

The same options can be stored in the schema as `appearance: { size, variant, labelPosition, theme }`,
which is what the visual builder edits.

Layout responds to the form's own width, not the window's: below about 480px every field
stacks full width, so a form in a narrow sidebar stacks even on a large screen.

## More features

```tsx
<Form
  schema={schema}
  lookup={(query) => api.lookup(query)}          // values for lookup fields, e.g. from another form
  onUpload={(file) => api.upload(file)}           // returns a URL or an object to store
  draft={{ key: 'admission-draft' }}              // keeps unfinished answers across reloads
  onSubmit={save}
/>
```

- **Lookup fields** fetch a value from a data source you provide: one record (`first`, `last`) or a
  total across many (`sum`, `count`, `avg`, `list`). Formulas can then use the result. On the
  server, `validateAsync(schema, body, { lookup })` fetches them again so a client cannot forge them.
- **File fields** accept `accept: '.pdf,image/*'` and `validate.maxSizeMb`.
- **More field types:** web address, star rating, slider, date range, address, signature.
- **Nepali** validation messages and button labels (`messagesNe`, `labelsNe`).

## Documentation

The guide lives in `apps/docs`. Read it locally with:

```bash
pnpm docs:dev   # http://localhost:5174
```

Let your own users design forms by embedding the builder:

```tsx
import { FormBuilder } from '@formknit/builder'
import '@formknit/react/styles.css'
import '@formknit/builder/styles.css'

<FormBuilder value={schema} onChange={setSchema} />
```

## The platform (early)

`apps/api` and `apps/web` are a hosted product built on the packages: sign in, design forms
with the builder, publish them, collect submissions, and export them.

```bash
pnpm seed       # once: creates a demo account and three sample forms
pnpm dev:api    # API on http://localhost:8787
pnpm dev:web    # app on http://localhost:5175
```

The demo sign-in is in `apps/api/scripts/seed.ts`. It is for local development only.

What works today:

- Accounts with sessions (passwords hashed with scrypt, session tokens stored hashed)
- Forms: create, edit in the builder with autosave, publish, unpublish, delete
- Draft and published versions are separate, so edits stay private until you publish
- Public form page at `/f/<address>`, validated again on the server
- Submissions: list, search, view, delete, export to CSV
- Settings: name, address, success message, submission limit, closing a form
- Lookups between forms, limited to fields the source form has marked as readable

It uses SQLite through Drizzle so it can move to PostgreSQL. Not built yet: teams and roles,
approval workflow, reports, version history, email, webhooks, payments, PDF, password reset.

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
pnpm changeset                          # record a change for the next release (see .changeset/README.md)
```

## Licence

MIT

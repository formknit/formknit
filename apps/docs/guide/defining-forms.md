# Defining forms

A form is a plain JSON document called the schema. You can write it by hand, build it in
code, or let the [visual builder](./builder) produce it. All three give the same thing.

## In code

Each builder function takes the field's key (its property name in the data) and returns a
chainable object:

```ts
import { form, text, number } from '@formknit/core'

const order = form('Order', [
  text('customer').label('Customer').placeholder('Full name').description('As on the invoice').required(),
  number('quantity').label('Quantity').min(1).max(100).default(1),
])
```

Methods available on every field:

| Method | Effect |
|---|---|
| `.label(text)`, `.placeholder(text)`, `.description(text)` | Display text |
| `.default(value)` | Starting value |
| `.required()` | Must be filled in |
| `.min(n)`, `.max(n)` | Number or date limits |
| `.minLength(n)`, `.maxLength(n)` | Text length |
| `.pattern(regex, message?)` | The whole value must match |
| `.minItems(n)`, `.maxItems(n)` | For lists: checkbox groups and repeaters |
| `.check(expression, message)` | A custom rule; see [validation](./validation) |
| `.visibleWhen(expression)` | Show only while the expression is true |
| `.requiredWhen(expression)`, `.disabledWhen(expression)` | Conditional required and read-only |
| `.width(n)` | Width in twelfths of the row; see [styling](./styling) |
| `.className(names)` | Extra CSS classes |
| `.set({ ... })` | Any other schema property |

The data type comes for free:

```ts
import type { InferData } from '@formknit/core'
type Order = InferData<typeof order> // { customer: string; quantity: number | null }
```

## As JSON

The same form as a schema:

```json
{
  "version": 1,
  "title": "Order",
  "pages": [
    {
      "key": "main",
      "components": [
        { "type": "text", "key": "customer", "label": "Customer", "validate": { "required": true } },
        { "type": "number", "key": "quantity", "label": "Quantity", "defaultValue": 1, "validate": { "min": 1, "max": 100 } }
      ]
    }
  ]
}
```

Store it in a database column and load it at runtime. Use `checkSchema(schema)` to list
mistakes (unknown field types, duplicate keys, broken formulas, circular references), and the
[command-line tool](./cli) to generate a TypeScript type from it.

Treat a schema as immutable: Formknit caches its analysis per schema object, so create a new
object when a form changes instead of editing one in place.

## Layout

Layout components group fields without changing the shape of the data:

```ts
import { panel, columns, content, divider } from '@formknit/core'

form('Profile', [
  content('About you', { heading: true }),
  columns([text('firstName')], [text('lastName')]),
  divider(),
  panel('Contact', [email('email'), phone('phone')]),
])
// data: { firstName, lastName, email, phone }
```

For simple side-by-side fields, `.width(6)` on each is usually enough and needs no layout
component.

## Repeating groups

A repeater holds a list of rows. Each row has the fields you give it:

```ts
repeater('items', [
  text('name').label('Item').required(),
  number('qty').label('Qty').min(1),
  number('rate').label('Rate'),
  calculated('amount', 'qty * rate').label('Amount'),
])
  .label('Items')
  .minItems(1)
  .set({ compact: true }) // rows side by side, like a table
// data: { items: [{ name, qty, rate, amount }, ...] }
```

Inside a row, a formula's bare names refer to that row first. Outside, `items.amount` reads
the column from every row, so `SUM(items.amount)` totals it. Repeaters can be nested.

## Multi-step forms

Pass pages instead of fields. Each step is validated before the next opens, and a page can be
conditional:

```ts
form('Admission', [
  page('personal', 'Personal', [text('fullName').required(), checkbox('needsHostel')]),
  page('hostel', 'Hostel', [text('roomType').required()]).visibleWhen('needsHostel'),
  page('confirm', 'Confirm', [checkbox('agree').required()]),
])
```

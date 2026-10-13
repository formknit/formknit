# @formknit/core

The engine behind [Formknit](https://github.com/formknit/formknit): form schemas as plain data,
Excel-style formulas, conditional logic and validation. No dependencies, and it runs the same in
the browser and on the server.

```bash
npm install @formknit/core
```

```ts
import { calculated, form, number, repeater, select, text, validate } from '@formknit/core'

const invoice = form('Fee invoice', [
  select('country', { NP: 'Nepal', IN: 'India' }).label('Country').required(),
  text('district').label('District').visibleWhen('country == "NP"').required(),
  repeater('items', [
    text('name').label('Item').required(),
    number('qty').label('Qty').min(1),
    number('rate').label('Rate'),
    calculated('amount', 'qty * rate'),
  ]).minItems(1),
  calculated('total', 'SUM(items.amount)'),
])

// On your server, for every submission:
const result = validate(invoice, request.body)
if (!result.valid) return respond(422, result.errors)
save(result.data)   // hidden and unknown fields removed, formulas worked out again
```

A schema is JSON, so it can also be stored in a database, edited with `@formknit/builder` and
sent over the network.

- **Formulas** such as `SUM(items.amount) * 1.13` and `IF(age >= 18, "Adult", "Minor")`, parsed and evaluated safely, never with `eval`
- **Conditions** for showing, requiring and disabling fields and whole pages
- **Validation** with built-in rules, your own rules written as formulas, and translated messages
- **Typed data**: `InferData<typeof invoice>` gives the exact shape of a submission
- **Lookups** that read a value from another data source, re-checked on the server with `validateAsync`
- **Your own field types** with `defineField`

To render forms, add `@formknit/react`. Full documentation is in the repository.

MIT licence.

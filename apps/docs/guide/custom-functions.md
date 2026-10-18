# Custom functions

[[toc]]

## Introduction

The [formula language](./expressions) has 28 built-in functions. You can add your own, for
calculations that belong to your business: tax rules, fee tables, check digits.

## Registering a function

```ts
import { registerFunction } from '@formknit/core'

registerFunction('VAT', ([amount]) => Math.round(Number(amount) * 0.13 * 100) / 100)
```

It is now available in every formula, in any case:

```ts
calculated('vat', 'VAT(subtotal)')
calculated('total', 'subtotal + vat(subtotal)')
```

The function receives its arguments as an array of already-evaluated values: numbers, text,
booleans, `null`, lists (for repeater columns) or objects (for composite fields such as an
address). It returns the result.

::: warning Register on the server too
`validate()` recalculates every formula. Register the same functions in your server code before
validating, or the server will report `#NAME?` for them.
:::

## Returning errors

Return an `ExprError` to signal a problem the same way built-in functions do:

```ts
import { ExprError, registerFunction } from '@formknit/core'

registerFunction('FEE', ([grade]) => {
  const fees: Record<string, number> = { '11': 9000, '12': 9500 }
  return fees[String(grade)] ?? new ExprError('#VALUE!', `No fee for grade ${grade}`)
})
```

The error flows through other formulas, shows on calculated fields, and can be caught with
`IFERROR`.

## Functions for one form only

Instead of registering globally, pass functions for one form or one call:

```tsx
const functions = { DISCOUNT: ([total]: unknown[]) => (Number(total) > 10000 ? 0.05 : 0) }

<Form schema={schema} compute={{ functions }} />
validate(schema, body, { functions })
evaluate('DISCOUNT(15000)', {}, { functions })
```

## Rules for custom functions

- **Be pure.** Return the same output for the same input, and do not change anything. A
  function may be called many times per keystroke.
- **Be fast.** No network requests. For data that lives elsewhere, use a
  [lookup field](./data#lookups) instead.
- **Accept anything.** Arguments can be empty, text or the wrong type. Use `Number(x)` and
  `String(x ?? '')`, and return an `ExprError` rather than throwing.

## Listing functions

`functionNames()` returns every available function name, built-in and registered, sorted. The
visual builder's formula editor uses it to offer them.

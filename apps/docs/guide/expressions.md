# Formulas

[[toc]]

## Introduction

Formknit has one small, spreadsheet-like expression language for every bit of logic in a
form. You will meet it in these places:

| Where | What the formula gives |
|---|---|
| `calculated(key, formula)` | The field's value |
| `visibleWhen` | Whether a field, panel or page is shown |
| `requiredWhen`, `disabledWhen` | Whether a field is required or read-only |
| `.check(formula, message)` | Whether a value passes a custom rule |
| a lookup's `matchValue` | The value to search for |

```
qty * rate * (1 + vat / 100)
country == "NP" AND (age >= 16 OR guardianConsent)
IF(SUM(items.amount) > 10000, "large", "small")
```

### Safe by design

Formulas are parsed and evaluated by Formknit's own interpreter. They are never turned into
JavaScript, so they cannot reach the network, the page, or anything outside the form's own
values. That makes it safe to store schemas in a database and to let your users write
formulas in the [visual builder](./builder). Long or deeply nested formulas are rejected, and
a formula that takes too many steps stops with an error instead of hanging the page.

## Values

| | Examples |
|---|---|
| Numbers | `12`, `3.5`, `-4` |
| Text | `"hello"` or `'hello'` |
| True and false | `TRUE`, `FALSE` |
| Nothing | `NULL` |
| A field | `price`, `fullName` |
| A part of a field | `stay.start`, `home.city` |
| A repeater column | `items.amount` (a list) |

Keywords and function names can be written in any case: `if`, `If` and `IF` are the same.
Field keys are case-sensitive.

## Operators

| Operator | Meaning |
|---|---|
| `+ - * /` | Arithmetic |
| `%` | Remainder |
| `^` | Power: `2 ^ 3` is 8 |
| `&` | Join text: `firstName & " " & lastName` |
| `==` (or `=`) | Equal |
| `!=` (or `<>`) | Not equal |
| `> >= < <=` | Comparison. Works on numbers, text and `YYYY-MM-DD` dates |
| `AND` (or `&&`) | Both |
| `OR` (or `\|\|`) | Either |
| `NOT` (or `!`) | Opposite |

Precedence follows mathematics: `^` first, then `* / %`, then `+ -`, then `&`, then
comparisons, then `NOT`, `AND`, `OR`. Use brackets when in doubt.

## Functions

```
SUM(items.amount)
ROUND(total * 0.13, 2)
IF(age >= 18, "Adult", "Minor")
DATEDIF(startDate, TODAY(), "Y")
```

All 28 built-in functions are described in the [function reference](./functions). You can
add your own with [`registerFunction`](./custom-functions).

## Reading fields

A formula reads other fields by their key. Formknit records which fields each formula reads
and recalculates it whenever one of them changes, in the right order, however long the chain.

- **Hidden fields read as empty.** If `fee` is hidden, `base + fee` gives `base`. This keeps
  totals honest when parts of a form do not apply.
- **Inside a repeater row**, a bare name means the row's own field first, then the form's.
  See [repeating groups](./repeaters#formulas-inside-rows).
- **`$value`** in a custom check means the field being checked.
- **Calculated fields can read calculated fields.** A loop (`a` reads `b`, `b` reads `a`) is a
  schema error, reported by `checkSchema` and in the builder.

## Empty values

Spreadsheet rules apply:

- In arithmetic, an empty field counts as 0: `qty * rate` is 0 until both are filled.
- `x == ""` is true for an empty field; `x == 0` is not.
- `ISEMPTY(x)` tests for empty text, `NULL` or an empty list. An unticked checkbox is `FALSE`,
  not empty: test it with `NOT agree`.
- `SUM`, `AVG`, `MIN` and `MAX` skip empty values.

## Text and numbers

Text that looks like a number is used as a number in arithmetic: `"12" * 2` is 24. Text that
does not, such as `"abc" * 2`, is an error. Comparing text is case-sensitive; use `LOWER()` or
`CONTAINS()` when it should not be.

Results are tidied to 15 significant digits, so `0.1 + 0.2` gives `0.3`, not
`0.30000000000000004`. For money, round explicitly: `ROUND(total * 0.13, 2)`.

## Errors

A formula that cannot be worked out returns an **error value** instead of crashing:

| Error | Cause |
|---|---|
| `#DIV/0!` | Division by zero |
| `#VALUE!` | The wrong kind of value, such as text in arithmetic or a bad date |
| `#NAME?` | An unknown function |
| `#NUM!` | A result that is not a finite number |
| `#LIMIT!` | The formula took too many steps |

Errors flow through other formulas (`#DIV/0! + 1` is still `#DIV/0!`). On a calculated field
the error is shown as a validation message, "Total could not be calculated (#DIV/0!)", which
also blocks submitting. Supply a fallback with `IFERROR`:

```
IFERROR(total / count, 0)
```

In conditions, an error counts as false.

## Truth

Where a formula is used as a condition, these count as **true**: `TRUE`, any number except
0, any non-empty text, any non-empty list. Everything else (empty values, `0`, `FALSE`,
errors) counts as false.

## Evaluating formulas yourself

Use `evaluate` to run a formula against any data, for example in a report:

```ts
import { evaluate } from '@formknit/core'

evaluate('SUM(items.amount) * 1.13', { items: [{ amount: 100 }, { amount: 50 }] })
// 169.5

evaluate('TODAY()', {}, { now: new Date('2027-01-15') })
// '2027-01-15'
```

The third argument takes `now` (for `TODAY()`), `functions` (extra functions for this call)
and `maxSteps`. To check a formula without running it, use `compile`, which throws
`ExprSyntaxError` with a readable message when it does not parse.

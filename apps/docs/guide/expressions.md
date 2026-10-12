# Formulas and rules

One small expression language is used everywhere a form needs logic:

| Where | Meaning |
|---|---|
| `calculated(key, formula)` | The field's value |
| `visibleWhen` | Show the field or page while true |
| `requiredWhen`, `disabledWhen` | Conditionally required or read-only |
| `.check(expression, message)` | A custom validation rule |
| `lookup`'s `matchValue` | The value to search for |

Expressions are parsed and evaluated by Formknit. They are never run as JavaScript, so a
schema from an untrusted source cannot execute code.

## Syntax

```
quantity * price * (1 + vatRate / 100)
country == "NP" AND (age >= 16 OR guardianConsent)
IF(total > 10000, "large", "small")
```

| | |
|---|---|
| Numbers and text | `12`, `3.5`, `"text"` or `'text'` |
| Fields | By key: `price`. A column of a repeater: `items.amount` |
| Arithmetic | `+ - * / %` and `^` for powers |
| Joining text | `firstName & " " & lastName` |
| Comparison | `== != > >= < <=` (`=` and `<>` also work) |
| Logic | `AND`, `OR`, `NOT` (`&&`, `||`, `!` also work) |
| Constants | `TRUE`, `FALSE`, `NULL` |

Keywords and function names are not case-sensitive. Text comparison is.

## Functions

| Function | Result |
|---|---|
| `SUM(a, b, …)`, `AVG`, `MIN`, `MAX` | Over numbers or a repeater column; empty values are skipped |
| `COUNT(a, …)` | How many are not empty. `COUNT(items)` counts rows |
| `ROUND(n, digits)`, `FLOOR(n)`, `CEIL(n)`, `ABS(n)`, `NUMBER(x)` | |
| `IF(condition, then, else)` | Only the chosen branch is evaluated |
| `IFERROR(value, fallback)` | The fallback when the value is an error |
| `AND(a, b, …)`, `OR(a, b, …)`, `NOT(a)` | Function forms of the operators |
| `CONCAT(a, b, …)`, `LEN(t)`, `UPPER(t)`, `LOWER(t)`, `TRIM(t)` | |
| `CONTAINS(listOrText, value)` | For checkbox groups: is the value ticked? For text: does it contain it (ignoring case)? |
| `ISEMPTY(x)`, `COALESCE(a, b, …)` | |
| `TODAY()` | Today as `YYYY-MM-DD` |
| `YEAR(d)`, `MONTH(d)`, `DAY(d)` | Parts of a date |
| `DATEDIF(start, end, "D" \| "M" \| "Y")` | Whole days, months or years between two dates |

Add your own with `registerFunction('VAT', ([n]) => Number(n) * 0.13)`.

## Rules worth knowing

- **Empty fields.** In arithmetic an empty field counts as 0. `x == ""` is true for an empty
  field, but `x == 0` is not.
- **Hidden fields read as empty.** If a fee field is hidden, `base + fee` gives `base`.
- **Rows.** Inside a repeater row, a bare name means that row's field first, then the form's.
- **Errors are values.** `10 / qty` with `qty` at 0 gives `#DIV/0!`. It is shown on the field
  as "could not be calculated" and never crashes the form. Wrap with `IFERROR` to supply a
  fallback.
- **Rounding.** Results are tidied to 15 significant digits, so `0.1 + 0.2` is `0.3`. Use
  `ROUND` for money.
- **Circular references** such as `a = b + 1`, `b = a + 1` are reported by `checkSchema`.

| Error | Cause |
|---|---|
| `#DIV/0!` | Division by zero |
| `#VALUE!` | Wrong kind of value, e.g. text in arithmetic or a list compared with `==` |
| `#NAME?` | Unknown function |
| `#NUM!` | Result is not a finite number |
| `#LIMIT!` | The expression took too many steps |

## Evaluating directly

```ts
import { evaluate } from '@formknit/core'
evaluate('SUM(items.amount) * 1.13', { items: [{ amount: 100 }, { amount: 50 }] }) // 169.5
```

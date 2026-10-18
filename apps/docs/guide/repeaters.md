# Repeating groups

[[toc]]

## Introduction

A repeater holds a list of rows that all have the same fields: invoice lines, family members,
previous employers. People add and remove rows; formulas can total a column.

```ts
import { calculated, number, repeater, text } from '@formknit/core'

repeater('items', [
  text('name').label('Item').required(),
  number('qty').label('Qty').min(1).default(1),
  number('rate').label('Rate'),
  calculated('amount', 'qty * rate').label('Amount'),
]).label('Items').minItems(1).maxItems(20)
```

The data is a list of objects:

```json
{ "items": [
  { "name": "Tuition", "qty": 1, "rate": 9000, "amount": 9000 },
  { "name": "Library", "qty": 1, "rate": 500,  "amount": 500 }
] }
```

## Rows

- **Add** appends a row with each field's default value.
- **Remove**, **Move up** and **Move down** act on one row. Moving keeps each row's values
  together.
- `minItems` and `maxItems` limit the number of rows. The Add button disappears at the
  maximum. `minItems` is also checked on submit, including when the list is empty.
- `.required()` on a repeater means at least one row.

To start with rows already in place, give a default:

```ts
repeater('items', [...]).default([{ name: 'Tuition', qty: 1, rate: 9000 }])
```

## Compact rows

By default each row is a small card with its fields stacked. For short rows, show the fields
side by side like a table:

```ts
repeater('items', [...]).set({ compact: true })
```

Labels are shown on the first row only (screen readers still announce them on every row), and
rows wrap onto more than one line on narrow forms.

## Formulas inside rows

Inside a row, a bare name refers to **that row's** field first, then to the form's:

```ts
repeater('items', [
  number('qty'),
  number('rate'),
  calculated('amount', 'qty * rate * (1 + vat / 100)'), // qty, rate: this row; vat: the form
])
number('vat').label('VAT %').default(13)
```

The same applies to `visibleWhen`, `requiredWhen`, `disabledWhen` and custom checks:

```ts
repeater('members', [
  select('relation', { child: 'Child', spouse: 'Spouse' }),
  date('born').label('Date of birth').visibleWhen('relation == "child"'),
])
```

## Totals across rows

Outside the repeater, `items.amount` means the `amount` column of every row, as a list.
Aggregate functions read lists:

```ts
calculated('subtotal', 'SUM(items.amount)')
calculated('average', 'AVG(items.rate)')
calculated('lines', 'COUNT(items)')      // number of rows
calculated('largest', 'MAX(items.amount)')
```

Empty cells are skipped by `SUM`, `AVG`, `MIN` and `MAX`.

## Nested repeaters

Repeaters can contain repeaters:

```ts
repeater('classes', [
  text('name').label('Class'),
  repeater('students', [text('student').label('Student')]).label('Students'),
  calculated('size', 'COUNT(students)'),
])
calculated('totalStudents', 'SUM(classes.size)')
```

Error paths and field paths include the row index: `classes.0.students.2.student`.

## Validation

Each row is validated with its own fields' rules. Errors are reported per cell, for example
`items.1.qty: ['Qty must be at least 1']`, and on the server `validate()` returns the same
paths.

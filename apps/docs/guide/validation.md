# Validation

[[toc]]

## Introduction

Formknit checks every value against three layers of rules:

1. **The field type's own format**: an email must look like an email, a date must exist, a
   choice must be one of the options.
2. **Built-in rules** you set: required, length, range, pattern, number of items, file size.
3. **Custom rules** written as formulas, for anything else.

The same rules run in the browser as people type and on your server in
[`validate()`](./server).

## When errors appear

In `<Form>`, a field's error is shown once the person has **left the field**, or after they
press **Next** or **Submit**. Errors never appear while someone is still typing into an
untouched field. On submit, focus moves to the first field with a problem, switching page if
needed.

Errors are linked to their controls with `aria-describedby` and announced by screen readers.

## Built-in rules

```ts
text('code').required().minLength(3).maxLength(10).pattern(/[A-Z]{3}\d+/, 'Use a code like ABC12')
number('age').min(16).max(60)
date('start').min('2026-01-01').max('2026-12-31')
checkboxGroup('days', { mon: 'Mon', tue: 'Tue', wed: 'Wed' }).minItems(1).maxItems(2)
repeater('items', [...]).minItems(1).maxItems(20)
file('cv').set({ validate: { maxSizeMb: 2 } })
```

| Rule | Applies to |
|---|---|
| `required` | Everything. On a checkbox or toggle it means ticked |
| `minLength`, `maxLength` | Text fields; rich text counts visible characters |
| `min`, `max` | Numbers, ratings, sliders and dates |
| `pattern` | Text fields. The whole value must match |
| `minItems`, `maxItems` | Checkbox groups and repeaters |
| `maxSizeMb` | Files |

An **empty** value is only checked by `required`. Other rules apply once something is
entered, so an optional email field can be left blank but cannot hold a bad address.

## Custom rules

`.check(formula, message)` adds a rule that must be true. The field's own value is `$value`;
other fields are available by key:

```ts
date('end').label('End date').check('$value >= start', 'End must be on or after the start')

number('discount').check('$value <= IF(member, 50, 10)', 'Discount is too high')

text('username').check('LEN($value) >= 4 AND NOT CONTAINS($value, " ")', 'At least 4 characters, no spaces')
```

A field may have several checks; each failing one adds its message. Custom checks only run
when the field has a value, like the built-in rules. In JSON they live in
`validate.rules`:

```json
{ "validate": { "rules": [ { "expression": "$value >= start", "message": "End must be on or after the start" } ] } }
```

## Conditional rules

```ts
text('reason').requiredWhen('status == "rejected"')
text('district').visibleWhen('country == "NP"').required()   // required only while shown
text('reference').disabledWhen('locked')                      // never validated while locked
```

Hidden and disabled fields are not validated. See [conditional logic](./conditional-logic).

## Calculated fields

A calculated field whose formula produces an error (`#DIV/0!` and the like) shows "…could not
be calculated" and blocks submitting. Use `IFERROR` to provide a fallback, or a `.check()` on
the calculated field to enforce a business rule:

```ts
calculated('total', 'SUM(items.amount)').check('$value <= 100000', 'Orders over 100,000 need approval')
```

## Messages

Every message comes from a set of functions you can replace. Each receives the field's label,
so you control word order and wording:

```tsx
const messages = {
  required: (label: string) => `Please fill in ${label}`,
  min: (label: string, n: number | string) => `${label} cannot be less than ${n}`,
}

<Form schema={schema} compute={{ messages }} />
validate(schema, body, { messages })            // the same on the server
```

| Message | Used when |
|---|---|
| `required` | A required field is empty |
| `mustTick` | A required checkbox or toggle is not ticked |
| `minLength`, `maxLength` | Text is too short or long |
| `min`, `max` | A number or date is out of range |
| `pattern` | `pattern` fails and no `patternMessage` is given |
| `email`, `phone`, `url`, `number`, `date`, `time` | The value is not in that format |
| `option` | A choice is not one of the options |
| `minItems`, `maxItems` | Too few or too many items |
| `fileSize`, `fileType` | A file is too large or of the wrong type |
| `signature`, `address`, `dateRange`, `dateOrder` | The value is incomplete or out of order |
| `calculation` | A formula produced an error |

For a whole language, see [translations](./i18n).

## Reading errors yourself

`validate()` and `computeState()` return errors keyed by field path:

```ts
{
  email: ['Email must be a valid email address'],
  'items.1.qty': ['Qty must be at least 1'],
}
```

Paths use dots and row numbers, matching the data. A field can have several messages; the
form shows the first.

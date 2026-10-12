# Validation and the server

## Built-in rules

Set with the builder methods or under `validate` in JSON:

```ts
text('code').required().minLength(3).maxLength(10).pattern(/[A-Z]{3}\d+/, 'Use a code like ABC12')
number('age').min(16).max(60)
date('start').min('2026-01-01')
checkboxGroup('days', { mon: 'Mon', tue: 'Tue' }).minItems(1)
```

Every field type also checks its own format (email, phone, URL, date, time, allowed choices,
file size and type).

## Custom rules

A rule is an expression that must be true. The field's own value is `$value`, and other fields
are available by key:

```ts
date('end').check('$value >= start', 'End must be on or after the start')
number('discount').check('$value <= IF(member, 50, 10)', 'Discount is too high')
```

## Conditional rules

```ts
text('reason').requiredWhen('status == "rejected"')
text('reference').disabledWhen('locked')
text('district').visibleWhen('country == "NP"').required() // required only while shown
```

A hidden field is not validated and is left out of the submitted data. A disabled field keeps
its value and is not validated.

## On the server

```ts
import { validate } from '@formknit/core'

const result = validate(schema, body)
result.valid   // boolean
result.errors  // { email: ['Email is required'], 'items.0.qty': ['Qty must be at least 1'] }
result.data    // safe to store when valid
```

`result.data` is cleaned:

- keys that are not in the schema are dropped
- hidden fields are dropped
- numbers typed as text are converted
- every calculated field is worked out again, so a total sent by the browser is ignored

`validate` throws `SchemaError` if the schema itself is broken. Malformed request bodies never
throw; they produce errors.

If the form has [lookup fields](./data#lookups), use `validateAsync` so their values are
fetched on the server too.

## Field state for your own UI

`computeState(schema, values)` returns everything a renderer needs: each field's `visible`,
`required`, `disabled`, `value` and `errors`, the calculated values, per-page validity, and the
cleaned data. It is a pure function, which is why the browser and the server always agree.

## Messages

Replace any message, for one call or globally by passing the same object everywhere:

```ts
validate(schema, body, { messages: { required: (label) => `Please fill in ${label}` } })
```

See [translations](./i18n) for a full language.

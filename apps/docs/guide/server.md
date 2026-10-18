# Validating on the server

[[toc]]

## Introduction

Anything checked in a browser can be skipped by someone sending a request directly, so
**every submission must be checked again on the server**. With Formknit that is one call, using
the very same schema:

```ts
import { validate } from '@formknit/core'

const result = validate(schema, requestBody)
result.valid    // true or false
result.errors   // { 'items.0.qty': ['Qty must be at least 1'] }
result.data     // safe to store when valid
```

`@formknit/core` has no dependencies and runs on Node.js, Bun, Deno, Cloudflare Workers and
other edge runtimes.

## What `validate` does

- applies every rule: types, built-in rules, custom checks, conditional requirements;
- skips fields and pages that are hidden for these answers;
- **recalculates every calculated field**, ignoring whatever the client sent for it;
- drops keys that are not in the schema, and hidden fields;
- converts values to their proper types (`"12"` to `12` in a number field).

So `result.data` is exactly what a well-behaved browser would have sent, whatever was actually
sent. Store that, never the raw body.

Malformed bodies (a string instead of an object, a list where a value belongs) produce errors,
never exceptions. `validate` throws only when the **schema** is broken (a `SchemaError` with
an `issues` list), which is a bug to fix rather than a bad request.

## Express

```ts
import express from 'express'
import { validate } from '@formknit/core'
import { signup } from './forms'

const app = express()
app.use(express.json({ limit: '1mb' }))

app.post('/api/signup', async (req, res) => {
  const result = validate(signup, req.body)
  if (!result.valid) return res.status(422).json({ errors: result.errors })
  await db.users.insert(result.data)
  res.json({ ok: true })
})
```

## Next.js route handler

```ts
// app/api/signup/route.ts
import { validate } from '@formknit/core'
import { signup } from '@/forms'

export async function POST(request: Request) {
  const result = validate(signup, await request.json())
  if (!result.valid) return Response.json({ errors: result.errors }, { status: 422 })
  await db.users.insert(result.data)
  return Response.json({ ok: true })
}
```

## Next.js server action

```ts
'use server'
import { validate } from '@formknit/core'
import { signup } from '@/forms'

export async function createUser(values: unknown) {
  const result = validate(signup, values as Record<string, unknown>)
  if (!result.valid) return { errors: result.errors }
  await db.users.insert(result.data)
  return { ok: true }
}
```

```tsx
<Form schema={signup} onSubmit={(data) => createUser(data)} />
```

## Hono, Fastify and others

Any framework works the same way: parse the JSON body, call `validate`, answer 422 with the
errors or store `result.data`.

```ts
app.post('/api/signup', async (c) => {
  const result = validate(signup, await c.req.json())
  return result.valid ? c.json(await save(result.data)) : c.json({ errors: result.errors }, 422)
})
```

## Forms stored in a database

When forms are created in the builder, store the schema as JSON and load it to validate:

```ts
app.post('/api/forms/:id/submissions', async (req, res) => {
  const form = await db.forms.find(req.params.id)
  const result = validate(form.schema, req.body)
  if (!result.valid) return res.status(422).json({ errors: result.errors })
  await db.submissions.insert({ formId: form.id, data: result.data })
  res.status(201).json({ ok: true })
})
```

Check schemas with `checkSchema` when they are **saved**, so a broken form is caught by its
author rather than its first respondent. Keep the version that was published alongside
each submission if forms change over time.

## Lookups

If a form has [lookup fields](./data#lookups), the browser's looked-up values cannot be
trusted either. Use `validateAsync` and give it the same resolver your API uses:

```ts
import { validateAsync } from '@formknit/core'

const result = await validateAsync(invoice, body, {
  lookup: (query) => lookupFromDatabase(query),
})
```

It fetches every lookup again on the server (repeating when one lookup feeds another) before
validating.

## Fixed dates in tests

`TODAY()` uses the current time. Pass `now` for repeatable results:

```ts
validate(schema, body, { now: new Date('2027-01-15T00:00:00Z') })
```

The options object also takes `messages` (see [validation](./validation#messages)) and
`functions` (see [custom functions](./custom-functions)).

## Computing state without validating

`computeState(schema, values)` returns everything `validate` uses, and more: each field's
`visible`, `required`, `disabled`, `value` and `errors`, per-page validity, and the cleaned
`data`. Use it to build your own renderer, a PDF of a submission, or a report that respects
the same visibility rules.

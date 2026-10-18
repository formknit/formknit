# Your first form

[[toc]]

This page builds a small but complete feature: a sign-up form with a conditional field, shown
in React and checked again on the server. It takes about ten minutes.

## 1. Describe the form

Create a file for your forms. Each builder function takes the field's **key**, its property
name in the submitted data, and returns an object you can chain settings onto:

```ts
// forms.ts
import { checkbox, email, form, select, text } from '@formknit/core'

export const signup = form('Sign up', [
  text('fullName').label('Full name').required().minLength(3),
  email('email').label('Email').required(),
  select('country', { NP: 'Nepal', IN: 'India', BT: 'Bhutan' }).label('Country').required(),
  text('district').label('District').visibleWhen('country == "NP"').required(),
  checkbox('agree').label('I accept the terms').required(),
])
```

`district` only appears, and is only required, while Nepal is chosen. That condition is a
[formula](./expressions): a small expression evaluated by Formknit.

## 2. Render it

```tsx
// SignupForm.tsx
import { Form } from '@formknit/react'
import '@formknit/react/styles.css'
import { signup } from './forms'

export function SignupForm() {
  return (
    <Form
      schema={signup}
      onSubmit={async (data) => {
        await fetch('/api/signup', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(data),
        })
      }}
    />
  )
}
```

`<Form>` draws every field, shows errors once someone leaves a field or presses Submit, moves
focus to the first problem, and calls `onSubmit` only when everything is valid. While the
promise you return is pending, the Submit button is disabled.

`data` is typed from the schema:

```ts
data.country   // 'NP' | 'IN' | 'BT' | ''
data.agree     // boolean
data.fullname  // ✗ compile error: did you mean fullName?
```

It is also **clean**: when Bhutan is chosen, `district` is not in `data` at all.

## 3. Check it on the server

A browser can send anything, so run the same schema over the request body. Here with
[Hono](https://hono.dev); any framework works the same way:

```ts
// server.ts
import { validate } from '@formknit/core'
import { Hono } from 'hono'
import { signup } from './forms'

const app = new Hono()

app.post('/api/signup', async (c) => {
  const result = validate(signup, await c.req.json())
  if (!result.valid) return c.json({ errors: result.errors }, 422)
  await db.users.insert(result.data)
  return c.json({ ok: true })
})
```

`result.errors` maps each field to its messages, for example
`{ email: ['Email must be a valid email address'] }`. `result.data` has unknown and hidden
fields removed and every formula worked out again, so it is safe to store.

## 4. Show server errors in the form

If the server rejects something the browser could not know about (an email already taken,
say), show the message yourself from `onSubmit`:

```tsx
const [error, setError] = useState<string>()

<Form
  schema={signup}
  onSubmit={async (data) => {
    const res = await fetch('/api/signup', { method: 'POST', body: JSON.stringify(data) })
    if (!res.ok) setError('That email is already registered')
  }}
>
  {error && <p role="alert">{error}</p>}
</Form>
```

Anything passed as children is rendered between the fields and the buttons.

## What you have

- one definition used in three places: rendering, browser validation, server validation;
- a conditional field that is shown, required and submitted only when it applies;
- typed, clean data.

## Next

- [How it works](./concepts): the model behind the API.
- [Field types](./fields): everything you can put in a form.
- [Formulas](./expressions): calculated fields and conditions.

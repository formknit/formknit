# Getting started

Formknit is three packages. Install the ones you need:

| Package | Use it for |
|---|---|
| `@formknit/core` | Defining forms and validating submissions. No dependencies; runs in browsers, Node and Bun |
| `@formknit/react` | Rendering forms in React |
| `@formknit/builder` | Letting people design forms by drag and drop |

```bash
npm install @formknit/core @formknit/react
```

::: warning Not published yet
The packages are not on npm yet. Until they are, clone the repository and run the playground
(`pnpm --filter @formknit/playground dev`).
:::

## Your first form

```tsx
import { form, text, email, select, checkbox } from '@formknit/core'
import { Form } from '@formknit/react'
import '@formknit/react/styles.css'

const signup = form('Sign up', [
  text('fullName').label('Full name').required().minLength(3),
  email('email').label('Email').required(),
  select('country', { NP: 'Nepal', IN: 'India' }).label('Country').required(),
  text('district').label('District').visibleWhen('country == "NP"'),
  checkbox('agree').label('I accept the terms').required(),
])

export function SignupForm() {
  return <Form schema={signup} onSubmit={(data) => fetch('/api/signup', { method: 'POST', body: JSON.stringify(data) })} />
}
```

`data` is typed from the form: `data.country` is `'' | 'NP' | 'IN'`, and a typo such as
`data.fullname` fails to compile.

## Check it again on the server

Never trust the browser. Run the same schema over the request body:

```ts
import { validate } from '@formknit/core'
import { signup } from './forms'

app.post('/api/signup', async (c) => {
  const result = validate(signup, await c.req.json())
  if (!result.valid) return c.json(result.errors, 422)
  await db.insert(result.data) // cleaned: hidden and unknown fields removed, formulas recalculated
  return c.json({ ok: true })
})
```

## Next

- [Defining forms](./defining-forms): pages, repeating groups and JSON schemas
- [Field types](./fields)
- [Formulas and rules](./expressions)

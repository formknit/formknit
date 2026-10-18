# @formknit/react

Renders [Formknit](https://github.com/formknit/formknit) forms in React: a `<Form>` component, a
themeable built-in look, and hooks for building your own.

```bash
npm install @formknit/core @formknit/react
```

```tsx
import { email, form, select, text } from '@formknit/core'
import { Form } from '@formknit/react'
import '@formknit/react/styles.css'

const contact = form('Contact us', [
  text('name').label('Name').required(),
  email('email').label('Email').required(),
  select('topic', { sales: 'Sales', support: 'Support' }).label('Topic'),
])

// `data` is typed from the schema
export const ContactForm = () => <Form schema={contact} onSubmit={(data) => send(data)} />
```

- **Any UI library.** Replace any field with your own component through `components`, or use a
  ready adapter: `@formknit/adapter-mui`, `@formknit/adapter-shadcn`
- **Styling.** Sizes (`sm`, `md`, `lg`), outlined, filled and underline inputs, light and dark
  themes, labels on top or at the side, and CSS variables for colours and spacing
- **Layout.** A twelve-column grid that stacks by itself in narrow containers
- **Multi-page forms**, repeating groups, file uploads, signatures, saved drafts
- **Headless.** `useForm`, `useFormState` and `useField` give you the state without the markup
- **Works with server rendering**, React 18 and 19

```tsx
<Form schema={contact} size="lg" variant="filled" theme="auto" components={{ fields: { text: MyTextField } }} />
```

Full documentation: [formknit.github.io/formknit](https://formknit.github.io/formknit/reference/react).

MIT licence.

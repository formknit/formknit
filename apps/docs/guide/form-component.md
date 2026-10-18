# The Form component

[[toc]]

## Introduction

`<Form>` renders a schema: every field, the step indicator for multi-page forms, error
messages and the buttons. It manages the values, runs validation, and calls `onSubmit` with
clean data.

```tsx
import { Form } from '@formknit/react'
import '@formknit/react/styles.css'

<Form schema={schema} onSubmit={(data) => save(data)} />
```

## Props

### Data and behaviour

| Prop | Type | |
|---|---|---|
| `schema` | `FormSchema` | Required. The form to render |
| `onSubmit` | `(data) => unknown` | Called with clean data once everything is valid. May return a promise |
| `defaultValues` | object | Starting values, e.g. an existing record to edit |
| `onChange` | `(values, state) => void` | Called after every change with the raw values and computed state |
| `onUpload` | `(file) => unknown` | Stores a chosen file; see [uploads](./data#file-uploads) |
| `lookup` | `(query) => unknown` | Answers lookup fields; see [lookups](./data#lookups) |
| `lookupDelay` | number | Milliseconds to wait after typing before a lookup. Default 250 |
| `draft` | `{ key, storage?, delay? }` | Keeps unfinished answers in the browser; see [drafts](./data#drafts) |
| `compute` | `{ messages?, functions?, now? }` | Replacement messages, extra functions, a fixed date |
| `form` | `FormStore` | A store from `useForm`, to control the form from outside |

### Appearance

| Prop | Values | |
|---|---|---|
| `size` | `sm`, `md`, `lg` | Control size |
| `variant` | `outlined`, `filled`, `underline` | Input style |
| `labelPosition` | `top`, `left` | Labels beside fields on wide forms |
| `theme` | `light`, `dark`, `auto` | `auto` follows the visitor's system setting |
| `className` | string | Added to the `<form>` element |
| `components` | adapter | Components to render with; see [adapters](./adapters) |
| `labels` | object | Button and step text; see [translations](./i18n) |
| `children` | React nodes | Rendered between the fields and the buttons |

The appearance props override the schema's own `appearance`.

## Submitting

`onSubmit` is called only when every visible field is valid. While a promise it returns is
pending, the submit button is disabled and a second press does nothing.

```tsx
<Form
  schema={order}
  onSubmit={async (data) => {
    const res = await fetch('/api/orders', { method: 'POST', body: JSON.stringify(data) })
    if (!res.ok) toast.error('Could not save the order')
  }}
/>
```

`data` is typed when the schema was built in code: see [the data type](./defining-forms#the-data-type).

The form does not reset itself after submitting, because you may want to show the answers
or navigate away. To start again, change the component's `key`, or call `reset()` on a store
from [`useForm`](./hooks).

## Editing existing records

Pass the record as `defaultValues`:

```tsx
<Form schema={profileForm} defaultValues={user} onSubmit={(data) => updateUser(user.id, data)} />
```

Keys that are not in the schema are ignored. `defaultValues` is read once, when the form is
created; to load a different record, give the component a new `key`.

## Reacting to changes

`onChange` receives the raw values and the [computed state](./server#computing-state-without-validating)
after every change:

```tsx
<Form
  schema={quote}
  onChange={(values, state) => setPreviewTotal(state.values.total)}
/>
```

## Extra content

Children are rendered after the fields and before the buttons, which is the right place for
terms, a captcha you add yourself, or a server error:

```tsx
<Form schema={signup} onSubmit={submit}>
  <p className="terms">By signing up you agree to our <a href="/terms">terms</a>.</p>
  {serverError && <p role="alert">{serverError}</p>}
</Form>
```

## Controlling the form from outside

For a submit button outside the form, a live summary next to it, or programmatic changes,
create the store yourself with `useForm` and pass it in:

```tsx
import { Form, useForm, useFormState } from '@formknit/react'

function Checkout() {
  const store = useForm(checkoutForm, { onSubmit: pay })
  const { state } = useFormState(store)

  return (
    <>
      <Form schema={checkoutForm} form={store} />
      <aside>Total: {String(state.values.total ?? 0)}</aside>
      <button onClick={() => store.setValue('coupon', 'WELCOME10')}>Apply welcome coupon</button>
    </>
  )
}
```

When `form` is given, the behaviour props (`onSubmit`, `defaultValues` and so on) are taken
from `useForm` instead. See [hooks](./hooks) for everything the store can do.

## Accessibility

The built-in components:

- tie every label to its control, and group choices in a `fieldset` with a `legend`;
- link help text and errors with `aria-describedby`, and mark invalid controls with
  `aria-invalid`;
- announce errors through a polite live region;
- move focus to the first problem on Next and Submit;
- work entirely with the keyboard, including the signature pad's clear button, star ratings
  and repeater row controls.

They pass an automated accessibility check for every field type, and the colours meet
contrast requirements in both the light and dark themes.

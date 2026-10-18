# Hooks and headless forms

[[toc]]

## Introduction

Everything `<Form>` does is available as a store and three hooks. Use them to:

- control a form from outside (a submit button in a toolbar, a live total in a sidebar);
- build your own markup around Formknit's logic, field by field;
- render forms without `<Form>` at all.

## useForm

`useForm(schema, options)` creates a form store and keeps it for the component's lifetime.
It takes the same options as `<Form>`'s behaviour props:

```tsx
import { useForm } from '@formknit/react'

const store = useForm(orderForm, {
  defaultValues: { quantity: 1 },
  onSubmit: (data) => save(data),
})
```

If the schema object changes, the store keeps the values that still apply.

### The store

| Method | |
|---|---|
| `getValue(path)` | A value, e.g. `getValue('items.0.qty')` |
| `setValue(path, value)` | Change a value; formulas and conditions update immediately |
| `touch(path)` | Mark a field as visited, so its error can be shown |
| `addRow(path, row?)` | Add a row to a repeater, optionally with values |
| `removeRow(path, index)` | Remove a row |
| `moveRow(path, from, to)` | Reorder rows |
| `next()` | Go to the next page if the current one is valid. Returns whether it moved |
| `back()` | Go to the previous page |
| `submit()` | Validate everything and call `onSubmit`. Resolves to whether it was valid |
| `reset(values?)` | Start again from these values, or the original defaults |
| `clearDraft()` | Remove the saved draft |
| `setSchema(schema)` | Swap the schema, keeping values that still apply |

## useFormState

`useFormState(store)` re-renders the component whenever the form changes and returns a
snapshot:

| Property | |
|---|---|
| `values` | The current raw values |
| `state` | The [computed state](./server#computing-state-without-validating): `values`, `data`, `fields`, `errors`, `valid`, `pages` |
| `pages` | The pages currently shown, each `{ index, key, title, valid }` |
| `step` | Position of the current page within `pages` |
| `submitting` | `onSubmit`'s promise is pending |
| `submitted` | Submit has been pressed at least once |

```tsx
const { state, submitting } = useFormState(store)
<button disabled={!state.valid || submitting} onClick={() => store.submit()}>Pay {String(state.values.total)}</button>
```

## useField

`useField(path, store?)` subscribes to one field. It re-renders only when that field's own
state changes, which keeps large forms fast:

```tsx
import { useField } from '@formknit/react'

function Quantity({ store }: { store: FormStore }) {
  const f = useField('quantity', store)
  if (!f.visible) return null
  return (
    <label>
      Quantity
      <input
        type="number"
        value={String(f.value ?? '')}
        disabled={f.disabled}
        onChange={(e) => f.setValue(e.target.value)}
        onBlur={f.onBlur}
      />
      {f.error && <span role="alert">{f.error}</span>}
    </label>
  )
}
```

It returns `value`, `errors` (all current problems), `error` (the one to show now: only once
the field is touched or Next/Submit was pressed), `visible`, `required`, `disabled`,
`touched`, `loading` (a lookup is in progress), plus `setValue` and `onBlur`.

Inside `<Form>` (in a custom field component, say) the `store` argument can be left out.

## A fully custom layout

Combine the three to keep Formknit's logic and write every bit of markup yourself:

```tsx
function CustomCheckout() {
  const store = useForm(checkoutForm, { onSubmit: pay })
  const { submitting } = useFormState(store)

  return (
    <form onSubmit={(e) => { e.preventDefault(); store.submit() }}>
      <section>
        <h2>You</h2>
        <MyInput store={store} path="fullName" label="Full name" />
        <MyInput store={store} path="email" label="Email" />
      </section>
      <section>
        <h2>Delivery</h2>
        <MyInput store={store} path="address" label="Address" />
      </section>
      <button disabled={submitting}>Pay</button>
    </form>
  )
}
```

Visibility, required marks, formulas and validation all still come from the schema.

## Multi-page forms

```tsx
const store = useForm(admissionForm, { onSubmit: apply })
const { pages, step } = useFormState(store)

<MyProgressBar value={(step + 1) / pages.length} labels={pages.map((p) => p.title)} />
<Form schema={admissionForm} form={store} />
```

`pages` only lists pages that are currently shown, so conditional pages appear and disappear
from it as answers change.

## Using the store outside React

`FormStore` is a plain class. It can drive forms in tests, scripts or another framework:

```ts
import { FormStore } from '@formknit/react'

const store = new FormStore(schema, { onSubmit: save })
store.setValue('qty', 3)
await store.submit()
store.subscribe(() => console.log(store.getSnapshot().values))
```

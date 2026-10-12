# Lookups, uploads and drafts

## Lookups

A lookup field fetches its value from somewhere you control: another form's submissions, your
database, an API. Formulas can then use it.

```ts
import { form, text, lookup, number, calculated } from '@formknit/core'

const invoice = form('Fee invoice', [
  text('rollNumber').label('Roll number').required(),
  lookup('studentName', { source: 'students', matchField: 'rollNo', matchValue: 'rollNumber', returnField: 'fullName' }).label('Student'),
  lookup('paid', { source: 'payments', matchField: 'rollNo', matchValue: 'rollNumber', returnField: 'amount', aggregate: 'sum' }).label('Paid so far'),
  number('due').label('Due'),
  calculated('balance', 'due - paid').label('Balance'),
])
```

`aggregate` says what to do when several records match: `first` (the default), `last`, `sum`,
`count`, `avg` or `list`.

You supply the function that answers the queries:

```tsx
<Form
  schema={invoice}
  lookup={async (query) => {
    // query: { source: 'students', where: { rollNo: '2027-0142' }, select: 'fullName', aggregate: 'first' }
    const res = await fetch('/api/lookup', { method: 'POST', body: JSON.stringify(query) })
    return res.json()
  }}
/>
```

The form waits until typing pauses (`lookupDelay`, 250 ms by default), shows the field as busy,
and ignores an answer that arrives after the query has changed.

On the server, fetch them again so a client cannot invent a value:

```ts
import { validateAsync } from '@formknit/core'
const result = await validateAsync(invoice, body, { lookup: (query) => db.lookup(query) })
```

::: warning Decide what may be looked up
Your `lookup` function is the gatekeeper. Check that the caller is allowed to read
`query.source` and `query.select`, or a public form could be used to read private data.
:::

## File uploads

```ts
field('file', 'cv', { label: 'CV', accept: '.pdf,image/*', validate: { maxSizeMb: 2, required: true } })
```

```tsx
<Form schema={schema} onUpload={async (file) => (await api.upload(file)).url} />
```

`onUpload` receives the `File` and returns where it was stored: a URL, or an object to merge in.
The data then holds `{ name, size, type, url }`. Without `onUpload` only the name, size and
type are kept.

The size and type in the data are what the browser reported. If they matter for security,
check the stored file itself on the server.

## Drafts

```tsx
<Form schema={schema} draft={{ key: 'admission-2027' }} />
```

Unfinished answers are saved in the browser's local storage shortly after each change,
restored when the form loads, and removed after a successful submit. Pass `storage` to use
something else (it needs `getItem`, `setItem` and `removeItem`), and `store.clearDraft()` to
discard one yourself.

To keep drafts on your server instead, use `onChange` to save and `defaultValues` to restore.

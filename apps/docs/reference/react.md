# @formknit/react

[[toc]]

Renders forms in React 18 and 19.

```bash
npm install @formknit/core @formknit/react
```

```ts
import '@formknit/react/styles.css'
```

## Components

| Export | |
|---|---|
| `Form` | Renders a schema. See [the Form component](/guide/form-component) for every prop |
| `FormProvider` | Provides a store, adapter and labels to custom components. Used by `Form` |

## Hooks

| Export | |
|---|---|
| `useForm(schema, options?)` | Create a `FormStore` for the component's lifetime |
| `useFormState(store)` | Subscribe to the whole form; returns a `FormSnapshot` |
| `useField(path, store?)` | Subscribe to one field; returns its `FieldSnapshot` with `setValue` and `onBlur` |
| `useFormContext()` | The `{ store, adapter, labels, idPrefix }` of the surrounding `Form` |

See [hooks](/guide/hooks).

## FormStore

| Member | |
|---|---|
| `new FormStore(schema, options?)` | Create a store outside React |
| `getSnapshot()`, `subscribe(listener)` | For `useSyncExternalStore` and other frameworks |
| `getField(path)` | A field's snapshot |
| `getValue(path)`, `setValue(path, value)` | Read and change values |
| `touch(path)` | Mark a field as visited |
| `addRow(path, row?)`, `removeRow(path, index)`, `moveRow(path, from, to)` | Repeater rows |
| `next()`, `back()` | Move between pages |
| `submit()` | Validate and call `onSubmit`. Resolves to whether it was valid |
| `reset(values?)` | Start again |
| `setSchema(schema)` | Swap the schema, keeping values that still apply |
| `clearDraft()` | Remove the saved draft |

### FormOptions

`defaultValues`, `onSubmit`, `onChange`, `onUpload`, `lookup`, `lookupDelay`, `draft`
(`{ key, storage?, delay? }`), `compute` (`{ messages?, functions?, now? }`).

### FormSnapshot

`values`, `state` (the core `FormState`), `pages` (`PageInfo[]`), `step`, `submitting`,
`submitted`.

### FieldSnapshot

`path`, `value`, `errors`, `error` (the one to show now), `visible`, `required`, `disabled`,
`touched`, `loading`.

## Adapters

| Export | |
|---|---|
| `defaultAdapter` | The built-in components |
| `describeAdapter(adapter)` | `{ own, fallback, missing }` field types |
| `Adapter`, `PartialAdapter` | Adapter types |
| `FieldProps`, `PanelProps`, `ColumnsProps`, `ContentProps`, `RepeaterProps`, `RepeaterRow`, `ButtonProps`, `StepsProps` | Component props; see [writing an adapter](/guide/writing-adapters) |

## Labels

| Export | |
|---|---|
| `defaultLabels` | English button and step text |
| `labelsNe` | Nepali |
| `Labels` | `submit`, `next`, `back`, `add`, `remove`, `moveUp`, `moveDown`, `step(current, total)`, `unknownField(type)` |

## Types

`FormProps`, `FormOptions`, `FormSnapshot`, `FieldSnapshot`, `PageInfo`, `DataOf<typeof schema>`.

## CSS

`@formknit/react/styles.css`: the built-in look and the responsive grid. Classes start with
`fx-`. See [styling](/guide/styling) for variables and helper classes.

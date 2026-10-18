# @formknit/core

[[toc]]

Schemas, formulas and validation. No dependencies; runs in browsers, Node.js, Bun, Deno and
edge runtimes. Ships as ES modules and CommonJS with TypeScript types.

```bash
npm install @formknit/core
```

## Building forms

| Export | |
|---|---|
| `form(title, children, options?)` | A form schema. `children` are fields or pages. `options`: `description`, `submitLabel` |
| `page(key, title, children)` | A page. Chain `.description()`, `.visibleWhen()` |
| `text`, `textarea`, `richText`, `email`, `phone`, `url`, `number`, `date`, `time`, `hidden`, `checkbox`, `toggle`, `file`, `signature`, `dateRange`, `address`, `slider` | `(key)` field builders |
| `rating(key, max = 5)` | Star rating |
| `select`, `radio`, `checkboxGroup` | `(key, choices)`. Choices as `{ value: 'Label' }` or `[{ label, value }]` |
| `calculated(key, formula)` | A calculated field |
| `lookup(key, { source, matchField, matchValue, returnField?, aggregate? })` | A lookup field |
| `repeater(key, children)` | A repeating group |
| `panel(label, children)` | A group with a heading |
| `columns(...cols)` | Side-by-side groups; each argument is an array of fields |
| `content(text, { heading? })`, `divider()` | Text and lines |
| `field(type, key, props?)` | Any field type, including custom ones |
| `FieldBuilder` | The class behind field builders; see [common settings](/guide/defining-forms#common-settings) |
| `InferData<typeof form>` | The type of a form's submitted data |

## Validating and computing

| Export | |
|---|---|
| `validate(schema, input, options?)` | `{ valid, errors, data }`. Throws `SchemaError` for a broken schema. See [server](/guide/server) |
| `validateAsync(schema, input, { lookup, ...options })` | Like `validate`, re-fetching lookups first |
| `resolveLookups(schema, input, lookup, options?)` | Just the lookup step: input with lookup values filled in |
| `computeState(schema, values, options?)` | The full [computed state](#formstate) |
| `getInitialValues(schema, values?)` | Starting values: defaults merged with `values` |
| `checkSchema(schema)` | `SchemaIssue[]`: problems in a schema |
| `SchemaError` | Thrown by `validate`; has `issues` |

`options` (`ComputeOptions`):

| | |
|---|---|
| `messages` | Replacement messages; see [validation](/guide/validation#messages) |
| `functions` | Extra formula functions for this call |
| `now` | The current time, for `TODAY()` |

### FormState

| Property | |
|---|---|
| `values` | Normalised values, formulas filled in, hidden fields kept |
| `data` | What to submit: visible fields only, unknown keys removed |
| `fields` | `Record<path, FieldState>` |
| `errors` | `Record<path, string[]>` |
| `valid` | No errors in any visible field |
| `pages` | `[{ key, visible, valid }]` |
| `isVisible(component, rowPath?)` | Whether a component is shown |
| `issues` | Schema problems found |

`FieldState`: `path`, `key`, `page`, `type`, `component`, `visible`, `required`, `disabled`,
`value`, `errors`, and for lookups `lookup` (the query to run, or `null`).

## Formulas

| Export | |
|---|---|
| `evaluate(formula, scope?, options?)` | Run a formula against data. `options`: `now`, `functions`, `maxSteps` |
| `compile(formula)` | Parse once: `{ source, ast, refs }`. Throws `ExprSyntaxError` |
| `registerFunction(name, fn)` | Add a function to every formula; see [custom functions](/guide/custom-functions) |
| `functionNames()` | Every available function name |
| `readPath(data, path)` | Read a path, mapping over lists |
| `isError(value)` | Whether a value is a formula error |
| `ExprError` | `new ExprError(code, message)`, returned by functions to signal an error |
| `ExprSyntaxError` | Thrown for a formula that does not parse |

## Field types

| Export | |
|---|---|
| `defineField(definition)` | Register or replace a field type; see [custom fields](/guide/custom-fields) |
| `getField(type)`, `listFields()` | Read the registry |

`FieldDefinition`: `type`, `kind` (`input`, `calculated`, `repeater`, `layout`, `content`),
`label`, `group`, `usesOptions?`, `emptyValue?`, `coerce?`, `isEmpty?`, `lengthOf?`,
`requiredMessage?`, `check?`.

## Rich text helpers

| Export | |
|---|---|
| `sanitizeHtml(html, { tags? })` | Clean HTML down to safe formatting |
| `htmlToText(html)` | The words, without markup |
| `RICH_TEXT_TAGS` | The tags kept by default |

## Messages and languages

| Export | |
|---|---|
| `defaultMessages` | English validation messages |
| `messagesNe` | Nepali validation messages |
| `Messages` | Their type |

## Types

`FormSchema`, `PageSchema`, `ComponentSchema`, `ColumnSchema`, `Validation`,
`ValidationRule`, `Option`, `Appearance`, `FormValues`, `LookupQuery`, `LookupResolver`,
`SchemaIssue`, `DateRange`, `Address`, `ValidationResult`, `FormState`, `FieldState`,
`PageState`, `ComputeOptions`, `ExprFunction`, `EvalOptions`. See the
[schema reference](/guide/schema).

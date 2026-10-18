# How it works

[[toc]]

A few ideas explain almost all of Formknit's API. Reading this page first will make the rest
of the documentation shorter.

## The schema

A form is a **schema**: a plain JSON document listing pages and the components on them. You
can write one by hand, build one with the code-first builders, or produce one with the visual
builder. All three give the same JSON:

```json
{
  "version": 1,
  "title": "Order",
  "pages": [
    {
      "key": "main",
      "components": [
        { "type": "text", "key": "customer", "label": "Customer", "validate": { "required": true } },
        { "type": "number", "key": "qty", "label": "Quantity", "validate": { "min": 1 } },
        { "type": "calculated", "key": "total", "label": "Total", "expression": "qty * 250" }
      ]
    }
  ]
}
```

Because it is data, a schema can be stored in a database, versioned, compared, sent over the
network and edited by people who do not write code. It never contains functions.

## Components and their kinds

Every entry in `components` has a `type`. Each type belongs to one **kind**, which decides how
it relates to the data:

| Kind | Types | In the data |
|---|---|---|
| input | `text`, `number`, `select`, `checkbox`, `file` … | One value under its `key` |
| calculated | `calculated` | A value produced by its formula |
| repeater | `repeater` | A list of rows, each an object |
| layout | `panel`, `columns` | Nothing; their fields belong to the surrounding object |
| content | `content`, `divider` | Nothing |

So a `text` field inside a `panel` inside `columns` still ends up at the top level of the
data. Only repeaters create nesting.

## State is computed, not stored

At the heart of the core package is one pure function:

```ts
computeState(schema, values) // → visibility, requirement, values, errors, cleaned data
```

Given a schema and the raw values typed so far, it works out everything else: which fields
are visible, required or disabled, what every formula evaluates to, which values are valid,
and what should be submitted. Nothing is remembered between calls.

This is why the browser and the server always agree. The React renderer calls it after every
keystroke; `validate()` on your server calls the same function once.

## Formulas

Wherever a form needs logic it uses one small expression language:

```
qty * rate                                  a calculated value
country == "NP"                             a condition (visibleWhen, requiredWhen, disabledWhen)
$value >= start                             a custom validation rule
IF(SUM(items.amount) > 10000, "large", "small")
```

Formulas read other fields by key. Formknit tracks which fields each formula reads and
recalculates only what changed, in the right order, and reports circular references.
Expressions are parsed and evaluated by Formknit; they are never run as JavaScript.

## Raw values and clean data

Formknit keeps two views of the answers:

- **values** are what the person typed, normalised (`"12"` becomes `12` for a number field)
  and with formulas filled in. Hidden fields keep their values, so hiding and showing a field
  again does not lose what was typed.
- **data** is what gets submitted: visible fields only, unknown keys removed, every
  calculated field recalculated. `onSubmit` receives this, and so does your database through
  `validate()`.

## The renderer

`@formknit/react` turns the computed state into components. It does not know how any field
looks; it asks an **adapter**, a map from field type to component. The built-in look is just
the default adapter. Swap it, or replace one field, and the same schema renders with a
different UI library.

Each field subscribes only to its own slice of state, so typing in one field re-renders that
field and the ones whose formulas depend on it, not the whole form.

## Putting it together

```
              ┌──────────── schema (JSON) ────────────┐
              │                                        │
   browser:  <Form> ── computeState() ── adapter ── your components
              │
   server:   validate() ── computeState() ── clean data ── database
              │
   builder:  <FormBuilder> edits the schema
```

## Next

- [Defining forms](./defining-forms): the code-first builders in detail.
- [Schema reference](./schema): every property of the JSON.

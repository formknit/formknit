# Schema reference

[[toc]]

## Introduction

This page lists every property of a form schema. You need it when you store forms as JSON,
generate them from another system, or write a [custom field type](./custom-fields). When
writing forms in code, the [builders](./defining-forms) set these for you.

TypeScript types for everything here are exported from `@formknit/core`: `FormSchema`,
`PageSchema`, `ComponentSchema`, `Validation` and `Appearance`.

## Form

```json
{
  "version": 1,
  "title": "Admission form",
  "description": "Apply for the 2027 intake.",
  "submitLabel": "Submit application",
  "appearance": { "size": "md", "variant": "outlined", "labelPosition": "top", "theme": "light" },
  "pages": [ ]
}
```

| Property | Type | |
|---|---|---|
| `version` | `1` | Required. The schema format version |
| `title` | string | Shown above the form |
| `description` | string | Shown under the title |
| `submitLabel` | string | Text of the submit button. Defaults to "Submit" |
| `appearance` | object | Look and feel; see [below](#appearance) |
| `pages` | array | Required. At least one page |

## Appearance

| Property | Values | Default |
|---|---|---|
| `size` | `sm`, `md`, `lg` | `md` |
| `variant` | `outlined`, `filled`, `underline` | `outlined` |
| `labelPosition` | `top`, `left` | `top` |
| `theme` | `light`, `dark`, `auto` | `light` |

Props on `<Form>` override these. See [styling](./styling).

## Page

```json
{ "key": "hostel", "title": "Hostel", "description": "Optional", "visibleWhen": "needsHostel", "components": [] }
```

| Property | Type | |
|---|---|---|
| `key` | string | Required. Unique among pages |
| `title` | string | Shown in the step indicator |
| `description` | string | Shown at the top of the page |
| `visibleWhen` | formula | The page is skipped while false |
| `components` | array | Required. The page's components |

A single-page form has one page; its title is not shown.

## Component

Properties shared by every component:

| Property | Type | |
|---|---|---|
| `type` | string | Required. A [field type](./fields) or a custom one |
| `key` | string | Required for fields that hold a value. Letters, digits and `_`, not starting with a digit |
| `label` | string | |
| `placeholder` | string | |
| `description` | string | Help text under the control |
| `defaultValue` | any | Starting value |
| `validate` | object | See [validation](#validation) |
| `visibleWhen` | formula | Shown, validated and submitted only while true |
| `requiredWhen` | formula | Required while true |
| `disabledWhen` | formula | Read-only and not validated while true |
| `width` | 1–12 | Columns of the 12-column grid. Omit for full width |
| `className` | string | Extra CSS classes on the wrapper |

Properties used by some types:

| Property | Used by | |
|---|---|---|
| `options` | `select`, `radio`, `checkboxGroup` | `[{ "label": "Nepal", "value": "NP" }]` |
| `expression` | `calculated` | The formula |
| `components` | `panel`, `repeater` | Child components |
| `columns` | `columns` | `[{ "width": 1, "components": [] }]`; `width` is relative |
| `content` | `content` | The text |
| `heading` | `content` | `true` to show the text as a heading |
| `compact` | `repeater` | Rows side by side, like a table |
| `rows` | `textarea` | Height in lines. Default 4 |
| `max` | `rating` | Number of stars. Default 5 |
| `step` | `slider` | Step between values. Default 1 |
| `accept` | `file` | Accepted types, e.g. `.pdf,image/*` |
| `toolbar` | `richText` | Toolbar buttons, e.g. `"bold, italic, link"` |
| `source`, `matchField`, `matchValue`, `returnField`, `aggregate` | `lookup` | See [lookups](./data#lookups) |

Custom field types may add their own properties. Any property not listed here is kept and
passed to the field's component.

## Validation

```json
{ "validate": {
  "required": true,
  "minLength": 3, "maxLength": 80,
  "min": 1, "max": 100,
  "pattern": "[A-Z]{3}\\d+", "patternMessage": "Use a code like ABC12",
  "minItems": 1, "maxItems": 5,
  "maxSizeMb": 2,
  "rules": [ { "expression": "$value != oldPassword", "message": "Choose a new password" } ]
} }
```

| Property | Applies to | |
|---|---|---|
| `required` | all | Must not be empty. Checkboxes must be ticked |
| `minLength`, `maxLength` | text-like | Number of characters (words, for rich text) |
| `min`, `max` | numbers, dates | Numbers, or `YYYY-MM-DD` for dates |
| `pattern` | text-like | A regular expression. The whole value must match; `^` and `$` are added for you |
| `patternMessage` | text-like | Message when `pattern` fails |
| `minItems`, `maxItems` | `checkboxGroup`, `repeater` | Number of items |
| `maxSizeMb` | `file` | Largest file, in megabytes |
| `rules` | all | Custom checks: `expression` must be true, else `message` |

## A complete example

```json
{
  "version": 1,
  "title": "Fee invoice",
  "pages": [
    {
      "key": "student",
      "title": "Student",
      "components": [
        { "type": "text", "key": "rollNumber", "label": "Roll number", "validate": { "required": true, "pattern": "\\d{4}-\\d{4}" } },
        { "type": "lookup", "key": "studentName", "label": "Student", "source": "students", "matchField": "rollNo", "matchValue": "rollNumber", "returnField": "fullName" }
      ]
    },
    {
      "key": "fees",
      "title": "Fees",
      "components": [
        {
          "type": "repeater", "key": "items", "label": "Items", "compact": true, "validate": { "minItems": 1 },
          "components": [
            { "type": "text", "key": "name", "label": "Item", "width": 6, "validate": { "required": true } },
            { "type": "number", "key": "amount", "label": "Amount", "width": 6, "validate": { "min": 0 } }
          ]
        },
        { "type": "calculated", "key": "total", "label": "Total", "expression": "SUM(items.amount)" }
      ]
    }
  ]
}
```

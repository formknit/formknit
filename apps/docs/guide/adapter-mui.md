# Material UI

[[toc]]

## Introduction

`@formknit/adapter-mui` renders forms with [Material UI](https://mui.com) components. Fields
follow your MUI theme: colours, typography, density and dark mode.

## Installation

```bash
npm install @formknit/adapter-mui @mui/material @emotion/react @emotion/styled
```

It needs Material UI 6 or newer.

## Usage

```tsx
import { muiAdapter } from '@formknit/adapter-mui'
import { Form } from '@formknit/react'
import '@formknit/react/styles.css'   // the grid; MUI styles the controls

<ThemeProvider theme={theme}>
  <Form schema={schema} components={muiAdapter} onSubmit={save} />
</ThemeProvider>
```

Pass the same adapter to the builder so its previews match:

```tsx
<FormBuilder value={schema} onChange={setSchema} components={muiAdapter} />
```

## What it covers

| Field types | MUI component |
|---|---|
| text, email, phone, url, number, date, time, textarea | `TextField` |
| select | `TextField` with `select` |
| radio | `RadioGroup` |
| checkbox, checkboxGroup | `Checkbox` with `FormControlLabel` |
| toggle | `Switch` |
| slider | `Slider` |
| rating | `Rating` |
| calculated, lookup | read-only `TextField` |
| file | `Button` with the chosen file's name |
| hidden | nothing visible |
| buttons, step indicator, panels, repeaters | `Button`, `Stepper`, `Paper` and friends |

Types without a natural MUI component (address, date range, signature) use the
built-in look, which takes its colours from the same CSS variables. Add rich text with
`withRichText(muiAdapter)` from `@formknit/richtext`.

To see exactly what is covered in your version, run `describeAdapter(muiAdapter)`.

## Customising

Theme overrides apply as usual. To change one component, override it:

```tsx
const components = {
  ...muiAdapter,
  fields: { ...muiAdapter.fields, date: MyMuiDatePicker },
}
```

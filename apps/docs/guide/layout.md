# Layout and pages

[[toc]]

## Introduction

Layout decides where fields appear without changing the shape of the data. Formknit gives you
four tools, from simplest to most structured:

1. **Widths**: place fields side by side on a 12-column grid.
2. **Panels and columns**: group fields visually.
3. **Content and dividers**: headings, paragraphs and lines between fields.
4. **Pages**: split a long form into steps.

## Widths

Every component sits on a 12-column grid. `.width(n)` sets how many columns it takes:

```ts
form('Address', [
  text('firstName').label('First name').width(6),   // half
  text('lastName').label('Last name').width(6),     // half
  text('city').label('City').width(4),              // a third
  text('region').label('Region').width(4),
  text('postcode').label('Postcode').width(4),
  textarea('notes').label('Notes'),                 // no width: the whole row
])
```

Fields flow left to right and wrap to a new row when the current one is full.

### Responsive behaviour

The grid responds to **the form's own width**, not the window's. When the form is narrower
than about 480px, every field stacks at full width, buttons stretch, and step labels shorten.
So a form placed in a narrow sidebar stacks even on a large screen, and you never need to
write breakpoints.

To show or hide something depending on the form's width, use the helper classes
`fx-hide-narrow` and `fx-show-narrow`; see [styling](./styling#helper-classes).

## Panels

A panel groups fields under a heading, with a border:

```ts
panel('Contact details', [
  email('email').label('Email'),
  phone('phone').label('Phone'),
])
```

The fields inside belong to the form's data as if the panel were not there:
`{ email, phone }`. Fields inside a panel can use widths too. A panel with `visibleWhen` hides
everything inside it.

## Columns

`columns` places groups of fields side by side. Each argument is one column:

```ts
columns(
  [text('firstName').label('First name'), date('born').label('Born')],
  [text('lastName').label('Last name'), select('gender', { f: 'Female', m: 'Male', x: 'Other' })],
)
```

Columns share the row equally. To make them unequal, give each a relative `width` in JSON:

```json
{ "type": "columns", "columns": [
  { "width": 2, "components": [ { "type": "text", "key": "street" } ] },
  { "width": 1, "components": [ { "type": "text", "key": "number" } ] }
] }
```

Columns stack on narrow forms, like widths. For simple side-by-side fields, widths are usually
enough; reach for columns when each side has several fields of different heights.

## Content and dividers

```ts
content('About you', { heading: true })
content('We only use your phone number to confirm the booking.')
divider()
```

`content` shows a heading or a paragraph; `divider` draws a line. Neither holds a value. Both
accept `.visibleWhen()`, which is handy for notes that only apply in some cases:

```ts
content('International applicants must upload a passport copy.').visibleWhen('country != "NP"')
```

## Multi-page forms

Give `form()` pages instead of fields to make a form with steps:

```ts
import { form, page } from '@formknit/core'

form('Admission', [
  page('personal', 'Personal details', [
    text('fullName').label('Full name').required(),
    checkbox('needsHostel').label('I need a hostel room'),
  ]),
  page('hostel', 'Hostel', [
    select('roomType', { single: 'Single', shared: 'Shared' }).label('Room type').required(),
  ]).visibleWhen('needsHostel'),
  page('confirm', 'Confirm', [
    checkbox('agree').label('The details above are correct').required(),
  ]).description('Check everything before you submit.'),
])
```

`page(key, title, fields)` takes a unique key, the title shown in the step indicator, and the
fields. Pages accept `.description()` and `.visibleWhen()`.

How multi-page forms behave:

- A step indicator shows where the person is: "Step 2 of 3".
- **Next** checks the current page. If something is wrong, it stays and moves focus to the
  first problem; later pages are not checked yet.
- **Back** never checks anything.
- A page whose `visibleWhen` is false is **skipped**, and its fields are neither validated nor
  submitted, exactly like a hidden field.
- **Submit** on the last page checks everything. If a problem is on an earlier page, the form
  goes back to it.
- The data has no nesting by page: fields from every page sit side by side.

To drive the steps yourself (a custom progress bar, say), see
[hooks](./hooks#multi-page-forms).

## Putting it together

```ts
form('Booking', [
  content('Who is staying?', { heading: true }),
  text('firstName').label('First name').width(6).required(),
  text('lastName').label('Last name').width(6).required(),
  divider(),
  panel('Stay', [
    dateRange('stay').label('Dates').width(8).required(),
    number('guests').label('Guests').width(4).min(1).max(6),
  ]),
  calculated('nights', 'DATEDIF(stay.start, stay.end, "D")').label('Nights'),
])
// data: { firstName, lastName, stay, guests, nights }
```

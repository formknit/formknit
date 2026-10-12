# Field types

| Type | Builder | Value in the data | Notes |
|---|---|---|---|
| `text` | `text(key)` | `string` | |
| `textarea` | `textarea(key)` | `string` | `rows` sets the height |
| `email` | `email(key)` | `string` | Must look like an email address |
| `phone` | `phone(key)` | `string` | Digits, spaces, `+ ( ) . -`; 6 to 20 characters |
| `url` | `url(key)` | `string` | Must start with `http://` or `https://` |
| `number` | `number(key)` | `number \| null` | Text typed in the box is converted |
| `date` | `date(key)` | `string` | `YYYY-MM-DD`; `.min()` and `.max()` take dates |
| `time` | `time(key)` | `string` | `HH:MM` |
| `dateRange` | `dateRange(key)` | `{ start, end } \| null` | End cannot be before start |
| `select` | `select(key, choices)` | one of the values, or `''` | |
| `radio` | `radio(key, choices)` | one of the values, or `''` | |
| `checkboxGroup` | `checkboxGroup(key, choices)` | array of values | |
| `checkbox` | `checkbox(key)` | `boolean` | Required means it must be ticked |
| `toggle` | `toggle(key)` | `boolean` | A switch |
| `rating` | `rating(key, max?)` | `number \| null` | Stars, 5 unless `max` is given |
| `slider` | `slider(key)` | `number \| null` | Range from `.min()` and `.max()`; `step` property |
| `address` | `address(key)` | `{ line1, line2, city, region, postcode, country } \| null` | Needs a street and a city |
| `signature` | `signature(key)` | `string` | A PNG data URL |
| `file` | `field('file', key, {...})` | `{ name, size, type, url? } \| null` | See [uploads](./data#file-uploads) |
| `hidden` | `hidden(key)` | anything | Not shown; carries a value through |
| `calculated` | `calculated(key, formula)` | number, text or boolean | Read-only; see [formulas](./expressions) |
| `lookup` | `lookup(key, query)` | whatever the source returns | Read-only; see [lookups](./data#lookups) |
| `repeater` | `repeater(key, fields)` | array of rows | See [repeating groups](./defining-forms#repeating-groups) |

Layout, with no value: `panel`, `columns`, `content` (text or a heading), `divider`.

## Choices

Give choices as an object of value to label, or as a list:

```ts
select('country', { NP: 'Nepal', IN: 'India' })
select('country', [{ label: 'Nepal', value: 'NP' }, { label: 'India', value: 'IN' }])
```

A submitted value that is not among the choices is rejected.

## Empty values

A field left empty is submitted as its empty value: `''` for text and choices, `null` for
numbers and composite fields, `false` for checkboxes, `[]` for lists. A hidden field (one whose
`visibleWhen` is false) is left out of the data entirely.

## Not built in

Rich text and Bikram Sambat dates are not included. Rich text stores HTML written by users,
which is only safe behind a well-tested sanitizer, and Bikram Sambat needs verified calendar
data. Both are good candidates for a [custom field](./custom-fields) wrapping an existing
library.

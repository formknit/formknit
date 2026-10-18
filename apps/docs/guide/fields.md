# Field types

[[toc]]

## Introduction

Every field has a `type`. This page lists each built-in type, its builder, the value it puts
in the data, and the settings it understands. Settings shared by all fields (label, required,
conditions…) are on [defining forms](./defining-forms#common-settings).

| Type | Builder | Value | |
|---|---|---|---|
| `text` | `text(key)` | `string` | Single line |
| `textarea` | `textarea(key)` | `string` | Several lines |
| `richText` | `richText(key)` | `string` (HTML) | [Formatted text](#rich-text) |
| `email` | `email(key)` | `string` | |
| `phone` | `phone(key)` | `string` | |
| `url` | `url(key)` | `string` | |
| `number` | `number(key)` | `number \| null` | |
| `date` | `date(key)` | `string` | `YYYY-MM-DD` |
| `time` | `time(key)` | `string` | `HH:MM` |
| `dateRange` | `dateRange(key)` | `{ start, end } \| null` | |
| `select` | `select(key, choices)` | a choice, or `''` | Dropdown |
| `radio` | `radio(key, choices)` | a choice, or `''` | |
| `checkboxGroup` | `checkboxGroup(key, choices)` | a list of choices | |
| `checkbox` | `checkbox(key)` | `boolean` | |
| `toggle` | `toggle(key)` | `boolean` | A switch |
| `rating` | `rating(key, max?)` | `number \| null` | Stars |
| `slider` | `slider(key)` | `number \| null` | |
| `address` | `address(key)` | object or `null` | |
| `signature` | `signature(key)` | `string` | PNG data URL |
| `file` | `file(key)` | object or `null` | |
| `hidden` | `hidden(key)` | anything | |
| `calculated` | `calculated(key, formula)` | number, text or boolean | Read-only |
| `lookup` | `lookup(key, query)` | whatever the source returns | Read-only |
| `repeater` | `repeater(key, fields)` | list of rows | See [repeating groups](./repeaters) |

Layout components hold no value: `panel`, `columns`, `content`, `divider`. See
[layout](./layout).

## Text fields

### text and textarea

```ts
text('fullName').label('Full name').minLength(3).maxLength(80)
textarea('message').label('Message').set({ rows: 6 })
```

`textarea` takes `rows` (default 4) for its height. Both accept `minLength`, `maxLength` and
`pattern`.

### email

```ts
email('email').label('Email').required()
```

Must look like `name@domain.tld`. Formknit does not check that the mailbox exists.

### phone

```ts
phone('mobile').label('Mobile')
```

Accepts 6 to 20 characters of digits, spaces and `+ ( ) . -`. Use `.pattern()` for a stricter
national format:

```ts
phone('mobile').pattern(/98\d{8}/, 'Enter a 10-digit number starting with 98')
```

### url

```ts
url('website').label('Website').placeholder('https://')
```

Must start with `http://` or `https://`.

### Rich text

```ts
richText('bio').label('About you').maxLength(2000)
```

Formatted text stored as HTML. The HTML is cleaned every time it is read, in the browser and
in `validate()`, so only harmless formatting can be stored. `minLength` and `maxLength` count
the words people see, not the markup. The editor itself comes from `@formknit/richtext`; see
[rich text](./rich-text).

## Numbers

### number

```ts
number('age').label('Age').min(16).max(99)
```

Text typed into the box is converted: `"12"` becomes `12`. Anything that is not a number is
an error. An empty box is `null`.

### rating

```ts
rating('satisfaction').label('How satisfied are you?')     // 1 to 5 stars
rating('score', 10).label('Score')                           // 1 to 10
```

The second argument sets the number of stars (`max` in JSON). A value above it is rejected.

### slider

```ts
slider('confidence').label('Confidence').min(0).max(10).set({ step: 0.5 })
```

The range comes from `min` and `max`; `step` defaults to 1.

## Dates and times

### date

```ts
date('dateOfBirth').label('Date of birth').max('2012-12-31')
```

Stored as `YYYY-MM-DD`, which sorts correctly as text and works with the date
[functions](./functions#dates). `min` and `max` take dates in the same format. Impossible
dates such as `2026-02-30` are rejected.

### time

```ts
time('arrival').label('Arrival time')
```

Stored as 24-hour `HH:MM` (seconds are allowed: `HH:MM:SS`).

### dateRange

```ts
dateRange('stay').label('Dates of stay')
```

Stored as `{ start: 'YYYY-MM-DD', end: 'YYYY-MM-DD' }`. Both dates are needed, and the end
cannot be before the start. In formulas, read the parts as `stay.start` and `stay.end`:

```ts
calculated('nights', 'DATEDIF(stay.start, stay.end, "D")')
```

## Choices

### Giving choices

`select`, `radio` and `checkboxGroup` take their choices as an object of value → label, or as
a list:

```ts
select('country', { NP: 'Nepal', IN: 'India' })
select('country', [{ label: 'Nepal', value: 'NP' }, { label: 'India', value: 'IN' }])
```

The **value** is what is stored; the **label** is what people see. Keep values short and
stable, and change labels freely. A submitted value that is not one of the choices is
rejected, so a client cannot invent one.

### select and radio

```ts
select('programme', { bsc: 'BSc', bba: 'BBA' }).label('Programme').placeholder('Choose one')
radio('plan', { basic: 'Basic', pro: 'Pro' }).label('Plan').required()
```

Both store one value, or `''` when nothing is chosen.

### checkboxGroup

```ts
checkboxGroup('days', { mon: 'Mon', tue: 'Tue', wed: 'Wed' }).label('Days').minItems(1).maxItems(2)
```

Stores a list of the ticked values. Test for one in a formula with
`CONTAINS(days, "mon")`.

### checkbox and toggle

```ts
checkbox('agree').label('I accept the terms').required()
toggle('newsletter').label('Send me the newsletter')
```

Store `true` or `false`. On these two, **required means it must be ticked**.

## Structured values

### address

```ts
address('home').label('Home address')
```

Stored as `{ line1, line2, city, region, postcode, country }`, all text. When filled in, at
least `line1` and `city` are needed. Read parts in formulas as `home.city`.

### signature

```ts
signature('sign').label('Signature').required()
```

A pad people draw on with a mouse, finger or pen. Stored as a PNG data URL
(`data:image/png;base64,…`), typically 5 to 30 KB.

### file

```ts
file('cv').label('CV').set({ accept: '.pdf,image/*', validate: { maxSizeMb: 2 } })
```

Stored as `{ name, size, type, url? }`. Without an upload handler only the name, size and
type are kept; with one, whatever your handler returns is merged in. See
[uploads](./data#file-uploads).

`accept` uses the same syntax as HTML: extensions (`.pdf`) and media types (`image/*`).
`maxSizeMb` is the largest size allowed.

::: warning The browser reports the size and type
They are what the person's browser said. If they matter, check the stored file on your server.
:::

## Computed and fetched values

### calculated

```ts
calculated('total', 'SUM(items.amount) * 1.13').label('Total')
```

A read-only field whose value is a [formula](./expressions). The value is recalculated on the
server too, so a total sent by the browser is ignored.

### lookup

```ts
lookup('studentName', { source: 'students', matchField: 'rollNo', matchValue: 'rollNumber', returnField: 'fullName' })
```

A read-only value fetched from a source you provide, such as another form's submissions or
your database. See [lookups](./data#lookups).

### hidden

```ts
hidden('campaign').default('autumn-2027')
```

Not shown. Carries a value through to the data, typically set with `.default()` or
`defaultValues`. Remember that people can change hidden values in their browser; do not rely
on one for anything security-related.

## Empty values

A field left empty is submitted as its **empty value**:

| Field | Empty value |
|---|---|
| text-like, `select`, `radio`, `signature`, `richText` | `''` |
| `number`, `rating`, `slider`, `dateRange`, `address`, `file`, `lookup` | `null` |
| `checkbox`, `toggle` | `false` |
| `checkboxGroup`, `repeater` | `[]` |

A field hidden by `visibleWhen` is left out of the data entirely.

## Not built in

A Bikram Sambat (Nepali calendar) date field is not included. It is a good example of a
[custom field type](./custom-fields), which can be published as its own package.

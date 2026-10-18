# Conditional logic

[[toc]]

## Introduction

Three settings make a field depend on others. Each takes a [formula](./expressions) that is
re-evaluated whenever the fields it reads change.

| Setting | While the formula is true, the field… |
|---|---|
| `visibleWhen` | is shown, validated and submitted |
| `requiredWhen` | must be filled in |
| `disabledWhen` | is read-only and not validated |

## Showing and hiding

```ts
select('country', { NP: 'Nepal', IN: 'India' }).label('Country')
text('district').label('District').visibleWhen('country == "NP"').required()
```

A hidden field:

- is not shown;
- is **not validated**, so `.required()` above only applies while Nepal is chosen;
- is **left out of the submitted data**, in the browser and in `validate()`;
- keeps what was typed, so hiding and showing it again does not lose the answer;
- **reads as empty in formulas**. If `fee` is hidden, `base + fee` is just `base`.

`visibleWhen` works on every component: fields, panels (hiding everything inside), content,
repeaters, fields inside repeater rows, and [pages](./layout#multi-page-forms).

## Requiring conditionally

```ts
select('status', { approved: 'Approved', rejected: 'Rejected' })
textarea('reason').label('Reason').requiredWhen('status == "rejected"')
```

The field is always shown, but only required while the formula is true. The required mark
appears and disappears with it.

## Disabling

```ts
checkbox('sameAsHome').label('Postal address is the same as home')
address('postal').label('Postal address').disabledWhen('sameAsHome')
```

A disabled field stays visible and keeps its value, which is still submitted, but cannot be
edited and is not validated.

## Writing conditions

Conditions are ordinary formulas whose result is treated as true or false:

```
country == "NP"
age >= 18 AND NOT student
CONTAINS(interests, "sport")          a checkbox group includes "sport"
ISEMPTY(referrer)
total > 10000 OR priority == "high"
```

What counts as true: `TRUE`, any number except 0, any non-empty text, any non-empty list.
Empty values, `0`, `FALSE` and errors count as false.

In the [visual builder](./builder), people can build these from rows of field, comparison and
value, or switch to writing the formula.

## Chains of conditions

Conditions may depend on fields that are themselves conditional:

```ts
checkbox('hasVehicle').label('I have a vehicle')
select('vehicleType', { car: 'Car', bike: 'Motorbike' }).visibleWhen('hasVehicle')
text('licence').label('Licence number').visibleWhen('vehicleType == "car"')
```

Unticking `hasVehicle` hides `vehicleType`, which now reads as empty, which hides `licence`.
Formknit works out the order automatically and reports circular conditions as schema errors.

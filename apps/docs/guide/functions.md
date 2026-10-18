# Function reference

[[toc]]

## Introduction

These are the 28 functions built into the [formula language](./expressions). Names are not
case-sensitive. Any argument can be a field, a literal or another formula. Functions marked
**list** also accept repeater columns such as `items.amount` and flatten them.

## Numbers

### SUM

`SUM(value, …)` (list) adds the numbers. Empty values are skipped.

```
SUM(items.amount)            → total of a column
SUM(tuition, hostel, 500)    → 3 fields and a number
```

### AVG

`AVG(value, …)` (list) is the average of the numbers, skipping empty values. Empty when there
are none.

### MIN and MAX

`MIN(value, …)` and `MAX(value, …)` (list) give the smallest or largest number, skipping
empty values.

```
MAX(items.amount)
MIN(budget, 50000)           → caps budget at 50000
```

### COUNT

`COUNT(value, …)` (list) counts the values that are not empty. With a repeater, counts its
rows.

```
COUNT(items)                 → number of rows
COUNT(items.receipt)         → rows with a receipt uploaded
```

### ROUND

`ROUND(number, digits)` rounds to the given number of decimal places (0 if left out). A half
rounds up: `ROUND(2.5)` is 3 and `ROUND(-2.5)` is -2.

```
ROUND(12.345, 2)   → 12.35
ROUND(1234, -2)    → 1200
```

### FLOOR, CEIL, ABS

`FLOOR(n)` rounds down, `CEIL(n)` rounds up, `ABS(n)` removes the sign.

### NUMBER

`NUMBER(value)` converts text such as `"42"` to a number. `#VALUE!` when it is not one.

## Logic

### IF

`IF(condition, then, else)` gives `then` when the condition is true, otherwise `else`. Only
the chosen branch is evaluated, so the other may contain an error without harm.

```
IF(age >= 18, "Adult", "Minor")
IF(qty > 0, total / qty, 0)
```

`else` may be left out; it is then empty.

### IFERROR

`IFERROR(value, fallback)` gives `fallback` when `value` is an [error](./expressions#errors).

```
IFERROR(total / count, 0)
```

### AND, OR, NOT

Function forms of the operators. `AND` and `OR` take any number of arguments.

```
AND(age >= 18, agree, NOT banned)
```

### ISEMPTY

`ISEMPTY(value)` is true for empty text, `NULL` and empty lists.

```
ISEMPTY(referrer)
```

### COALESCE

`COALESCE(value, …)` (list) gives the first value that is not empty.

```
COALESCE(nickname, firstName, "Guest")
```

## Text

### CONCAT

`CONCAT(value, …)` (list) joins values as text. The same as `&` between each.

### LEN

`LEN(text)` is the number of characters.

### UPPER, LOWER, TRIM

Change case, or remove spaces from both ends.

### CONTAINS

`CONTAINS(listOrText, value)` has two uses:

- On a list, such as a checkbox group: is `value` one of the items?
- On text: does it contain `value`, ignoring case?

```
CONTAINS(interests, "sport")        → a checkbox group includes "sport"
CONTAINS(email, "@school.edu.np")
```

## Dates

Dates are text in `YYYY-MM-DD` form, which is what date fields store.

### TODAY

`TODAY()` is today's date. On a server, pass `now` to `validate` or `evaluate` to fix the
date for tests.

### YEAR, MONTH, DAY

The parts of a date as numbers.

```
YEAR(dateOfBirth)
```

### DATEDIF

`DATEDIF(start, end, unit)` is the number of whole units between two dates. `unit` is `"D"`
(days, the default), `"M"` (months) or `"Y"` (years).

```
DATEDIF(dateOfBirth, TODAY(), "Y")       → age in years
DATEDIF(stay.start, stay.end, "D")       → nights
```

The result is negative when `end` is before `start`, and empty when either date is empty.

## Adding functions

See [custom functions](./custom-functions).

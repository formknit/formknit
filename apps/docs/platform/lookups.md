# Lookups between forms

[[toc]]

## Introduction

A [lookup field](/guide/data#lookups) fills itself from another form's submissions. In the
platform, the source is another form in the **same workspace**. A typical use: a fee
payment form that shows the student's name, and the total already paid, as soon as a roll
number is typed.

## Setting it up

**1. Choose what the source form shares.** In the source form (say, *Student register*), open
**Settings → Data access** and tick the fields other forms may read, for example `rollNo`,
`fullName` and `paid`. Nothing is shared until you tick it. Note the form's address, for
example `student-register`.

**2. Add a lookup field to the other form.** In the builder, add a **Lookup** field and set:

| Setting | Example | |
|---|---|---|
| Data source | `student-register` | The source form's address |
| Field to match in the source | `rollNo` | The field in the source to search |
| Value to match | `rollNumber` | A formula, usually a field of this form |
| Field to return | `fullName` | The field to read from the match |
| If several records match | Use the first | What to do with several matches |

**3. Publish both forms.**

## Combining several matches

| If several records match | Result |
|---|---|
| Use the first / Use the last | The oldest or newest match |
| Add them up | Total of the returned field across all matches |
| Count them | Number of matches |
| Average them | Average of the returned field |
| List them all | All the values |

So adding up `paid` gives the total paid by a student across every payment submission.

## Using the result

A lookup's value can be used in formulas like any other field:

```
due - paidSoFar
IF(ISEMPTY(studentName), "Unknown roll number", "")
```

## Security

- Only fields ticked under **Data access** can be matched on or returned.
- The public page can only ask the questions its own lookup fields define; it cannot be used
  to search the source form freely.
- Lookups never cross workspaces.
- On submit, lookups are fetched again on the server, so a respondent cannot change a
  looked-up value.

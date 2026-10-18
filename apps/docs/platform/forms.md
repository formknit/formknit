# Forms and publishing

[[toc]]

## Introduction

In the platform, a form has two versions at any time:

- the **draft**, which you edit in the builder and which saves itself as you work;
- the **published** version, which is what respondents see at the form's public address.

Changing the draft never affects respondents until you **publish**.

## Creating a form

From **Forms → New form**, start from a blank form or a template:

| Template | |
|---|---|
| Contact form | Name, email, message |
| Admission form | A multi-step application with conditional fields |
| Event registration | Attendee details and choices |
| Feedback survey | Ratings and comments |
| Invoice | Line items with calculated totals |

**Duplicate** copies a form, including its settings, as a new private draft.

## Building

The **Build** tab is the [visual builder](/guide/builder). Changes save automatically a moment
after you stop typing. Problems with the form (a duplicate key, a broken formula) are listed
at the top and must be fixed before publishing.

## Publishing

**Publish** makes the current draft the live version. The form gets a public address:

```
https://forms.example.com/f/student-admission
```

The address comes from the form's name and can be changed under **Settings**. The **Share**
tab has the link to copy and an `<iframe>` snippet to embed the form in another website.

After publishing, the form shows **unpublished changes** whenever the draft differs from what
respondents see. Publish again to update the live form. **Unpublish** takes the form offline;
its address then shows "not found".

## Versions

Every publish is kept under **Versions**, numbered from 1. Restoring a version copies it into
the draft; respondents see no change until you publish again. Each submission is validated
against the version that was live when it was sent.

## Settings

| Setting | |
|---|---|
| Address | The part after `/f/`. Lowercase letters, digits and dashes |
| Success message | Shown after someone submits |
| Opens at, closes at | The form accepts responses only between these times. Either may be left empty |
| Maximum submissions | Stops accepting responses after this many |
| Closed | Stops accepting responses now, without unpublishing |
| Notification emails | Addresses emailed with the answers of each new submission |
| Data access | Fields other forms in the workspace may read with lookups; see [lookups](./lookups) |
| Webhooks | See [webhooks](./webhooks) |

A form that is not accepting responses still shows its public page, with a message saying why
(not open yet, ended, full or closed).

## The public page

The public page renders the published form with the built-in look. It works on phones,
supports every field type, uploads files as they are chosen, and keeps a draft in the
respondent's browser so a reload does not lose their answers.

Answers are validated again on the server with the published schema: hidden fields are
dropped, formulas are recalculated, and lookups are re-fetched.

## Deleting

**Delete** removes the form, every submission, and their uploaded files. It cannot be undone.
Only admins and owners can delete forms.

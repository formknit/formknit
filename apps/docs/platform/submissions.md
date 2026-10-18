# Submissions and review

[[toc]]

## Introduction

Every response to a published form becomes a **submission**. The **Submissions** tab lists
them newest first, with search, a status filter and CSV export.

## Finding submissions

- **Search** finds text anywhere in the answers, ignoring case.
- **Status** filters to new, in review, approved or rejected.
- The list shows the first few fields of each submission; open one to see everything.

## Reviewing

Each submission has a **status**:

| Status | Meaning |
|---|---|
| New | Just arrived |
| In review | Someone is looking at it |
| Approved | Accepted |
| Rejected | Not accepted |

Change it from the submission page. Changing a status sends a `submission.status_changed`
[webhook](./webhooks), so other systems can react to approvals.

**Notes** are private comments for your team, shown beside the answers with their author and
time. Respondents never see them.

## Editing and deleting

Editors can correct a submission's answers. The edit form is the same form, validated with
the same rules, so a correction cannot introduce invalid data. Deleting a submission removes
it and its files permanently.

## Files

Uploaded files are private. They can be downloaded from the submission page by members of
the workspace, and through the [API](./api). Each file is limited by its field's
**largest size** setting, and never more than 10 MB.

## Exporting

**Export CSV** downloads every submission with one column per field, plus the submission time,
id and status. It opens directly in Excel, Google Sheets and Numbers. Values that a
spreadsheet would treat as formulas are made safe, and rich text is exported as plain text.

## Reports

The **Reports** tab summarises a form:

- total submissions and submissions per day;
- for each choice field, how many chose each option;
- for each number field, the count, total, average, smallest and largest.

The **dashboard** shows the same at a glance across all forms in the workspace, with the
latest submissions.

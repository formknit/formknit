# REST API

[[toc]]

## Introduction

The platform has a JSON API under `/api`. The web app uses it, and your own programs can use
it to read forms and submissions with an **API key**.

Requests and responses are JSON. Times are milliseconds since 1970. Errors look like this:

```json
{ "error": { "code": "not_found", "message": "Form not found" } }
```

Validation errors add a `fields` object mapping each field to its messages.

## API keys

Create a key under **Account → API keys**. The key is shown **once**; store it somewhere safe.
Only a hash is kept on the server, so a lost key cannot be recovered: delete it and create a
new one.

Send it as a bearer token:

```bash
curl https://forms.example.com/api/forms \
  -H "Authorization: Bearer fk_xxxxxxxxxxxxxxxxxxxxxxxx"
```

A key:

- belongs to **one workspace**, the one active when it was created;
- can **only read** (`GET` requests), whatever its creator's role;
- stops working when deleted, or when its creator leaves or is removed from the workspace;
- records when it was last used, shown on the Account page.

Keys cannot manage accounts, members or keys.

## Reading forms

### List forms

```http
GET /api/forms
```

```json
{ "forms": [ { "id": "6b1f…", "name": "Admission form", "slug": "admission", "status": "published",
  "publishedAt": 1805016413000, "updatedAt": 1805016413000, "submissions": 42,
  "unpublishedChanges": false, "closedReason": null } ] }
```

`closedReason` is `null` while a published form accepts responses, otherwise `closed`,
`not_open`, `ended` or `full`.

### Get a form

```http
GET /api/forms/:id
```

Adds `schema` (the draft), `settings` and `issues` (problems found in the schema).

### Versions and report

```http
GET /api/forms/:id/versions
GET /api/forms/:id/report
```

## Reading submissions

### List submissions

```http
GET /api/forms/:id/submissions?limit=25&offset=0&q=sharma&status=approved
```

| Parameter | |
|---|---|
| `limit` | 1 to 100. Default 25 |
| `offset` | How many to skip, for paging |
| `q` | Text to search for in the answers, ignoring case |
| `status` | `new`, `in_review`, `approved` or `rejected` |

```json
{
  "submissions": [ { "id": "a83c…", "formId": "6b1f…", "status": "new", "data": { }, "createdAt": 1805016413000, "updatedAt": null } ],
  "total": 42,
  "columns": [ { "key": "fullName", "label": "Full name", "type": "text" } ]
}
```

Newest first. Page through with `offset` until you have `total`.

### Export as CSV

```http
GET /api/forms/:id/submissions.csv
```

### Get one submission

```http
GET /api/submissions/:id
```

Returns the submission, its form's name and schema, its notes and the form's columns.

### Download a file

```http
GET /api/files/:id
```

File answers in `data` look like `{ "name": "cv.pdf", "size": 48213, "type": "application/pdf", "url": "/api/files/9c2e…" }`.
Prefix `url` with your address and send the key to download it.

## Public endpoints

These need no key; they are what the public form page uses:

| | |
|---|---|
| `GET /api/public/forms/:slug` | The published schema and whether it is open |
| `POST /api/public/forms/:slug/submissions` | Submit answers (the JSON body is the answers). Returns `201` with the submission id and success message, or `422` with field errors |
| `POST /api/public/forms/:slug/files?field=key` | Upload one file (multipart, field `file`) for a file field |
| `POST /api/public/forms/:slug/lookup` | Answer one of the form's own lookup questions |

They are rate limited per visitor. You can use the submission endpoint to send answers from
your own front end; they are validated exactly like the public page's.

## Signed-in endpoints

Everything else (creating and editing forms, publishing, changing statuses, notes, webhooks,
members and invitations) is used by the web app with a signed-in session cookie, and checks
the member's [role](./teams#roles) on every request. These endpoints are not yet a stable
public API and may change between versions. The full list is in `apps/api/src/app.ts`.

## Limits

| | |
|---|---|
| Request body | 1 MB |
| Uploaded file | The field's largest size, at most 10 MB |
| Sign-in attempts | 10 per 15 minutes per email address and visitor |
| Password reset requests | 5 per 15 minutes per email address and visitor |
| Submissions | 30 per minute per visitor and form |
| Uploads | 20 per minute per visitor and form |
| Lookups | 120 per minute per visitor and form |

Exceeding a limit returns `429`.

# Database

[[toc]]

## Introduction

The platform stores everything (accounts, forms, submissions, notes, webhooks) in either
**SQLite** or **PostgreSQL**. Both are fully supported, and the test suite runs against each.
Uploaded files are stored on disk, not in the database.

| | SQLite | PostgreSQL |
|---|---|---|
| Setup | Nothing: one file | A database server |
| Good for | One server, a few thousand submissions a day | Larger installs, managed databases, several app servers |
| Backups | Copy one file (safely; see below) | `pg_dump` or your provider's backups |

## Choosing

Set `DATABASE_URL`:

```bash
DATABASE_URL=/data/formknit.sqlite                                # SQLite file
DATABASE_URL=postgres://formknit:secret@db.example.com:5432/formknit   # PostgreSQL
```

Leaving it unset uses `formknit.sqlite` in the working directory.

Pick one before collecting real data: nothing copies data from one to the other yet.

## Tables and upgrades

Tables are created on the first start and upgraded automatically when a new version starts.
There is nothing to run by hand. Upgrades are applied in order and recorded in a
`migrations` table.

With PostgreSQL and several app servers, start **one** server first after upgrading, let it
finish starting, then start the rest, so two servers do not run the same upgrade at once.

## PostgreSQL notes

- Any currently supported PostgreSQL version. The Docker Compose setup uses PostgreSQL 17, and
  the tests run against PGlite, an embedded build of PostgreSQL.
- The database user needs permission to create tables in its database.
- Answers are stored as JSON text, so searching submissions works the same on both databases.

## Searching submissions

The submissions search looks for the text anywhere in the stored answers, ignoring case. It scans
the form's submissions, which is fast for tens of thousands of rows. Very large
forms will want a dedicated search index in a future version.

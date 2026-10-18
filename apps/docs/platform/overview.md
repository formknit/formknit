# The self-hosted platform

[[toc]]

## Introduction

The Formknit platform is a complete web application built on the Formknit packages. Run it
on your own server and your team gets a place to design forms, publish them at public
addresses, collect and review submissions, and send the data on to other systems, without
writing code.

It is optional. If you only want forms inside your own React app, the
[library](/guide/introduction) is all you need.

## What it does

- **Forms**: create forms from scratch or from templates, edit them in the visual builder with
  autosave, and publish them. Drafts and published versions are kept apart, every publish is
  kept in a version history, and any version can be restored.
- **Public pages**: each published form gets an address, `/f/<address>`, that anyone can
  fill in, on any device, without an account. Answers are checked again on the server.
- **Opening times**: open and close forms on a schedule, cap the number of responses, or
  close by hand.
- **Submissions**: search, filter, view, edit, delete and export to CSV.
- **Review**: each submission is *new*, *in review*, *approved* or *rejected*, with private
  notes for the team.
- **Reports**: totals, submissions per day, and a breakdown of every choice and number field.
- **Notifications**: email chosen addresses on each new submission.
- **Teams**: workspaces with members in five roles, invited by email.
- **Integrations**: signed webhooks with a delivery log, and a read-only REST API with keys.
- **Lookups between forms**: one form can read values from another form's submissions, for
  example a fee form that looks up a student by roll number.

## How it is built

| Part | Technology |
|---|---|
| API | [Hono](https://hono.dev) on Node.js |
| Web app | React and Vite, served by the API in production |
| Database | SQLite (default) or PostgreSQL, through Drizzle |
| Files | A folder on disk |
| Email | Any SMTP server |

One process serves both the API and the web app, so a deployment is a single address. It
runs comfortably on a small virtual server.

## Status

The platform is newer than the library. It is fully tested (the API's test suite runs against
both SQLite and PostgreSQL) but not yet used widely. Read [security](./security) before
putting it on the internet, and keep [backups](./maintenance).

Not built yet: payments, Google Sheets sync, PDF and Excel export, and transferring ownership
of a workspace.

## Next

- [Installation](./installation)
- [Configuration](./configuration)

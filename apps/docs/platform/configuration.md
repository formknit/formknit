# Configuration

[[toc]]

## Introduction

The platform is configured with environment variables. With Docker Compose, put them in
`.env`; otherwise set them in your process manager.

## Settings

| Variable | Default | |
|---|---|---|
| `WEB_ORIGIN` | `http://localhost:5175` | **The address people open in their browser**, with no trailing slash. Several may be given, separated by commas; the first is used in emailed links |
| `DATABASE_URL` | `formknit.sqlite` | A SQLite file path, or a `postgres://` address. See [database](./database) |
| `UPLOAD_DIR` | `uploads` | Folder for uploaded files |
| `WEB_DIR` | not set | Folder with the built web app. When set, the API serves it too |
| `PORT` | `8787` | Port to listen on |
| `SMTP_URL` | not set | Mail server. Without it, no email is sent. See [email](./email) |
| `MAIL_FROM` | `Formknit <no-reply@localhost>` | Sender of emails |
| `REGISTRATION` | `open` | `open`: anyone can create an account. `invite`: only the first account and invited people |
| `NODE_ENV` | | Set to `production` on a live server |

The Docker image sets `NODE_ENV=production`, `WEB_DIR`, `DATABASE_URL=/data/formknit.sqlite`
and `UPLOAD_DIR=/data/uploads` for you, and Compose sets `DATABASE_URL` to its PostgreSQL
container.

## WEB_ORIGIN matters

`WEB_ORIGIN` is used for three things, so set it to exactly what appears in the browser's
address bar, including `https://`:

1. **Request checks**: requests that change data from any other origin are refused.
2. **Cookies**: sign-in cookies are marked `Secure` when it starts with `https://`.
3. **Links** in emails: password resets, invitations and notifications.

## Registration

Most self-hosted installs should use `REGISTRATION=invite`:

- the very first account can always be created, and becomes the owner of its workspace;
- after that, people can only sign up with an invitation link sent to their address.

With `open`, anyone who can reach the site can create an account and their own workspace.
They cannot see other workspaces, but they can use your server's storage and email.

## Production versus development

With `NODE_ENV=production`:

- webhooks may only point at public `https://` addresses;
- without `SMTP_URL`, emails are recorded but not sent, and a warning is printed at start-up.

In development, webhooks may point at `http://localhost`, and emails are printed in the
terminal.

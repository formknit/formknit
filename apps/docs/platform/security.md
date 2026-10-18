# Security

[[toc]]

## Introduction

This page describes how the platform protects your data, and what you need to do when you
run it. Report security problems privately, as described in the repository's `SECURITY.md`.

## Your checklist

1. **Serve it over HTTPS**, behind a reverse proxy such as Caddy or nginx, and set
   `WEB_ORIGIN` to the `https://` address. Sign-in cookies are only marked `Secure` then.
2. **Set `REGISTRATION=invite`** unless you want strangers to create accounts.
3. **Configure email** before inviting people, so resets and invitations work.
4. **Back up** the database and the upload folder; see [backups](./maintenance).
5. **Keep it updated**; see [upgrading](./maintenance#upgrading).
6. **Do not expose the database** to the internet. With Compose, PostgreSQL is only reachable
   from the app container.

A minimal Caddy configuration, which also obtains the certificate:

```
forms.example.com {
  reverse_proxy localhost:8787
}
```

Behind a proxy, the platform reads the visitor's address from `X-Forwarded-For` for rate
limiting. Make sure your proxy sets it, and that the app's port is not reachable directly.

## Accounts and sessions

- Passwords must be 12 to 200 characters and are stored with **scrypt**, a deliberately slow
  hash, with a random salt per password.
- Sessions last 30 days. The cookie is `HttpOnly` (scripts cannot read it) and `SameSite=Lax`.
  Only a hash of the session token is stored, so a copy of the database contains no usable
  sessions.
- Changing or resetting a password ends the account's other sessions.
- Password reset links last one hour and work once. Asking for a reset never reveals whether
  an account exists.
- Sign-in and reset attempts are rate limited.

## Requests

- Requests that change data must come from `WEB_ORIGIN`; others are refused. This blocks
  cross-site request forgery.
- Request bodies are limited to 1 MB.
- Every signed-in request checks the member's role in the workspace. Data from other
  workspaces behaves as if it does not exist.

## Submissions

- Answers are validated on the server with the published schema. Hidden and unknown fields
  are dropped and formulas recalculated, so a respondent cannot store values the form would
  not allow.
- Rich text answers are cleaned to a short list of safe tags before they are stored and again
  before they are shown.
- CSV exports neutralise values that spreadsheets would run as formulas.
- Uploaded files are private, checked against the field's type and size limits, and served
  only to workspace members and API keys.

## Webhooks and lookups

- Webhooks are signed, and in production may only target public `https://` addresses.
- Lookups only read fields the source form has explicitly shared, within one workspace, and
  are fetched again on the server.

## Known limitations

- **Rate limits are kept in memory**, so they reset when the server restarts and are not
  shared between several servers.
- **Webhook addresses are checked when saved**, by name. A domain that later changes to point
  at a private address is not re-checked at delivery time. Restrict outgoing traffic from the
  server with a firewall if this matters to you.
- There is no two-factor sign-in yet.

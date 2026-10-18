# Email

[[toc]]

## Introduction

The platform sends email for:

- **password resets**, with a link valid for one hour;
- **invitations** to a workspace, valid for seven days;
- **notifications** of new submissions, to addresses chosen per form.

Every email is also recorded in the `outbox` table, with when it was sent or why it failed.

## Connecting a mail server

Set `SMTP_URL` and `MAIL_FROM`:

```bash
SMTP_URL=smtps://user:password@smtp.example.com:465
MAIL_FROM=Forms <forms@example.com>
```

| Address form | |
|---|---|
| `smtps://user:password@host:465` | Encrypted from the start (port 465) |
| `smtp://user:password@host:587` | Upgrades to an encrypted connection when the server offers it |

Special characters in the user name or password must be percent-encoded: `@` becomes `%40`,
`:` becomes `%3A`.

## Providers

Any provider with SMTP works. Typical settings:

| Provider | `SMTP_URL` |
|---|---|
| Gmail / Google Workspace | `smtps://you%40example.com:APP-PASSWORD@smtp.gmail.com:465` (needs an app password) |
| Amazon SES | `smtp://SMTP-USER:SMTP-PASSWORD@email-smtp.REGION.amazonaws.com:587` |
| Mailgun | `smtp://postmaster%40mg.example.com:PASSWORD@smtp.mailgun.org:587` |
| Resend | `smtps://resend:API-KEY@smtp.resend.com:465` |
| Postmark | `smtp://SERVER-TOKEN:SERVER-TOKEN@smtp.postmarkapp.com:587` |

Check your provider's documentation for the current host names. Set up SPF and DKIM for the
`MAIL_FROM` domain, or emails will land in spam folders.

## Without a mail server

- **Development**: emails are printed in the API's terminal, so you can follow reset and
  invitation links.
- **Production**: emails are recorded in the outbox but not sent. Password resets and
  invitations will not reach anyone, so configure SMTP before inviting people.

## Failures

If sending fails, the error is recorded in the outbox and the action that caused the email
still succeeds: a submission is saved even if its notification could not be sent. Failed
emails are not retried.

# Installation

[[toc]]

## Introduction

There are three ways to run the platform:

| | Best for |
|---|---|
| [Docker Compose with PostgreSQL](#docker-compose) | Most production installs |
| [Docker with SQLite](#docker-with-sqlite) | Small installs: one team, modest traffic |
| [Without Docker](#without-docker) | Development, or servers where Docker is not an option |

All three serve the API and the web app from one address on port 8787. Put a reverse proxy
with HTTPS in front before real use; see [security](./security).

## Docker Compose

You need Docker with the Compose plugin.

```bash
git clone https://github.com/formknit/formknit.git
cd formknit
cp .env.example .env
```

Edit `.env`:

```bash
WEB_ORIGIN=https://forms.example.com       # the address people will use
POSTGRES_PASSWORD=change-me-to-something-long
SMTP_URL=smtps://user:password@smtp.example.com:465
MAIL_FROM=Forms <forms@example.com>
REGISTRATION=invite
```

Start it:

```bash
docker compose up -d
```

This starts two containers: the app, and PostgreSQL 17. Data is kept in two Docker volumes,
`database` and `uploads`.

Open your address and **create the first account**: it becomes the owner of the first
workspace. With `REGISTRATION=invite`, nobody else can sign up without an invitation.

## Docker with SQLite

For a small install, one container is enough. The SQLite database and uploaded files live in
one volume:

```bash
docker build -t formknit .
docker run -d --name formknit -p 8787:8787 \
  -v formknit-data:/data \
  -e WEB_ORIGIN=https://forms.example.com \
  -e REGISTRATION=invite \
  -e SMTP_URL=smtps://user:password@smtp.example.com:465 \
  -e MAIL_FROM="Forms <forms@example.com>" \
  formknit
```

## Without Docker

You need Node.js 22 or newer.

```bash
git clone https://github.com/formknit/formknit.git
cd formknit
corepack enable
pnpm install
pnpm --filter "@formknit/web..." build
cd apps/api
WEB_DIR=../web/dist WEB_ORIGIN=https://forms.example.com node --import tsx src/index.ts
```

Run it under a process manager such as systemd or PM2 so it restarts after a crash or reboot.
A systemd unit:

```ini
[Unit]
Description=Formknit
After=network.target

[Service]
WorkingDirectory=/srv/formknit/apps/api
ExecStart=/usr/bin/node --import tsx src/index.ts
Environment=NODE_ENV=production
Environment=WEB_DIR=../web/dist
Environment=WEB_ORIGIN=https://forms.example.com
Environment=DATABASE_URL=/var/lib/formknit/formknit.sqlite
Environment=UPLOAD_DIR=/var/lib/formknit/uploads
EnvironmentFile=/etc/formknit.env
Restart=always
User=formknit

[Install]
WantedBy=multi-user.target
```

Keep secrets such as `SMTP_URL` in the `EnvironmentFile`, readable only by the service's user.

## Development

To work on the platform itself:

```bash
pnpm install
pnpm seed       # once: two demo accounts and three sample forms
pnpm dev:api    # API on http://localhost:8787
pnpm dev:web    # web app on http://localhost:5175
```

The seed creates an owner and a reviewer in one workspace; their sign-in details are in
`apps/api/scripts/seed.ts`. In development, emails are printed in the API's terminal.

## Checking it works

- Open the address, create the first account, and create a form from a template.
- Publish it, open its public link in a private window, and submit it.
- See the submission appear, and check that the notification email arrived (or appears in the
  terminal in development).

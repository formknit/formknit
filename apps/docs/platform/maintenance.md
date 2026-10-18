# Backups and upgrades

[[toc]]

## What to back up

| What | Where |
|---|---|
| The database | The SQLite file (`DATABASE_URL`), or your PostgreSQL database |
| Uploaded files | The `UPLOAD_DIR` folder |
| Configuration | Your `.env` or environment settings |

With the Docker setups these live in Docker volumes: `database` and `uploads` with Compose,
and `formknit-data` with the single SQLite container.

## Backing up SQLite

SQLite runs in write-ahead mode, so copying the file while the server is writing can produce a
broken copy. Use SQLite's own backup command, which is safe while running:

```bash
sqlite3 /data/formknit.sqlite ".backup '/backups/formknit-$(date +%F).sqlite'"
```

Or stop the server, copy `formknit.sqlite` together with any `formknit.sqlite-wal` and
`formknit.sqlite-shm` files, and start it again.

## Backing up PostgreSQL

```bash
docker compose exec db pg_dump -U formknit formknit > formknit-$(date +%F).sql
```

Managed PostgreSQL services usually provide automatic backups; turn them on.

## Backing up files

```bash
docker run --rm -v formknit_uploads:/data -v "$PWD":/backup alpine \
  tar czf /backup/uploads-$(date +%F).tar.gz -C /data .
```

The volume name has your Compose project name as a prefix (`formknit_` above); check with
`docker volume ls`.

Test a restore now and then. A backup you have never restored is a hope, not a backup.

## Upgrading

Read the [release notes](/guide/release-notes) for anything to do by hand, back up, then:

::: code-group

```bash [Docker Compose]
git pull
docker compose up -d --build
```

```bash [Without Docker]
git pull
pnpm install
pnpm --filter "@formknit/web..." build
sudo systemctl restart formknit
```

:::

Database changes are applied automatically when the new version starts. With several app
servers on PostgreSQL, start one first and let it finish before starting the others.

## Restoring

1. Stop the app.
2. Put back the database (copy the SQLite file, or load the dump with `psql`) and the upload
   folder.
3. Start the app with the same version, or a newer one, as the backup was taken with.

Restoring a backup into an **older** version of the platform is not supported.

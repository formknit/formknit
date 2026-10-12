import type { FormSchema } from '@formknit/core'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as pg from 'drizzle-orm/pg-core'
import { integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { ROLES } from './roles'

/** Per-form options that are not part of the schema. */
export interface FormSettings {
  /** Shown to the respondent after a successful submit. */
  successMessage?: string
  /** Stops new submissions without unpublishing the form. */
  closed?: boolean
  maxSubmissions?: number
  /** Field keys other forms may read through lookup fields. Nothing is readable unless listed. */
  exposedFields?: string[]
  /** The form accepts responses only between these moments (ISO date-times). Either may be left out. */
  opensAt?: string
  closesAt?: string
  /** Addresses emailed whenever a submission arrives. */
  notifyEmails?: string[]
}

export const STATUSES = ['new', 'in_review', 'approved', 'rejected'] as const
export type Status = (typeof STATUSES)[number]

/**
 * The database is SQLite unless DATABASE_URL names a PostgreSQL server (`postgres://…`).
 * `pglite:` runs PostgreSQL inside this process, which is how the tests cover it.
 */
export const DATABASE_URL = process.env.DATABASE_URL ?? process.env.DATABASE_PATH ?? 'formknit.sqlite'
const isPg = (url: string) => /^(postgres(ql)?|pglite):/.test(url)
export const POSTGRES = isPg(DATABASE_URL)

// Both databases get the same tables: timestamps are milliseconds since 1970 and JSON is stored
// as text. The tables are written once against these column helpers.
const sqliteKit = {
  table: sqliteTable,
  primaryKey,
  text,
  int: (name: string) => integer(name),
  time: (name: string) => integer(name),
  bool: (name: string) => integer(name, { mode: 'boolean' }),
  json: (name: string) => text(name, { mode: 'json' }),
}
type Kit = typeof sqliteKit

const pgJson = pg.customType<{ data: unknown; driverData: string }>({
  dataType: () => 'text',
  toDriver: (value) => JSON.stringify(value),
  fromDriver: (value) => JSON.parse(value),
})
// Typed as the SQLite helpers so the rest of the code is written once. The two query builders
// share every method the app uses.
const pgKit = {
  table: pg.pgTable,
  primaryKey: pg.primaryKey,
  text: pg.text,
  int: (name: string) => pg.integer(name),
  time: (name: string) => pg.bigint(name, { mode: 'number' }),
  bool: (name: string) => pg.boolean(name),
  json: (name: string) => pgJson(name),
} as unknown as Kit

function defineTables(k: Kit) {
  const users = k.table('users', {
    id: k.text('id').primaryKey(),
    email: k.text('email').notNull().unique(),
    name: k.text('name').notNull(),
    passwordHash: k.text('password_hash').notNull(),
    createdAt: k.time('created_at').notNull(),
  })

  /** A team's space. Forms belong to a workspace, and people get access by being members of it. */
  const workspaces = k.table('workspaces', {
    id: k.text('id').primaryKey(),
    name: k.text('name').notNull(),
    createdAt: k.time('created_at').notNull(),
  })

  const members = k.table(
    'members',
    {
      workspaceId: k.text('workspace_id').notNull(),
      userId: k.text('user_id').notNull(),
      role: k.text('role', { enum: ROLES }).notNull(),
      createdAt: k.time('created_at').notNull(),
    },
    (t) => [k.primaryKey({ columns: [t.workspaceId, t.userId] })],
  )

  const invites = k.table('invites', {
    /** SHA-256 of the token in the emailed link. */
    id: k.text('id').primaryKey(),
    workspaceId: k.text('workspace_id').notNull(),
    email: k.text('email').notNull(),
    role: k.text('role', { enum: ROLES }).notNull(),
    invitedBy: k.text('invited_by').notNull(),
    expiresAt: k.time('expires_at').notNull(),
    acceptedAt: k.time('accepted_at'),
    createdAt: k.time('created_at').notNull(),
  })

  const sessions = k.table('sessions', {
    /** SHA-256 of the session token, so a leaked database does not leak usable sessions. */
    id: k.text('id').primaryKey(),
    userId: k.text('user_id').notNull(),
    /** The workspace this session is currently working in. */
    workspaceId: k.text('workspace_id'),
    expiresAt: k.time('expires_at').notNull(),
    createdAt: k.time('created_at').notNull(),
  })

  const forms = k.table('forms', {
    id: k.text('id').primaryKey(),
    /** Who created the form. Access is decided by the workspace, not by this. */
    ownerId: k.text('owner_id').notNull(),
    workspaceId: k.text('workspace_id').notNull(),
    name: k.text('name').notNull(),
    slug: k.text('slug').notNull().unique(),
    status: k.text('status', { enum: ['draft', 'published'] }).notNull(),
    /** The working copy edited in the builder. */
    schema: k.json('schema').$type<FormSchema>().notNull(),
    /** What respondents see. Only changes when the form is published. */
    publishedSchema: k.json('published_schema').$type<FormSchema>(),
    publishedAt: k.time('published_at'),
    settings: k.json('settings').$type<FormSettings>().notNull(),
    createdAt: k.time('created_at').notNull(),
    updatedAt: k.time('updated_at').notNull(),
  })

  const submissions = k.table('submissions', {
    id: k.text('id').primaryKey(),
    formId: k.text('form_id').notNull(),
    data: k.json('data').$type<Record<string, unknown>>().notNull(),
    status: k.text('status', { enum: STATUSES }).notNull().default('new'),
    createdAt: k.time('created_at').notNull(),
    updatedAt: k.time('updated_at'),
  })

  const notes = k.table('submission_notes', {
    id: k.text('id').primaryKey(),
    submissionId: k.text('submission_id').notNull(),
    userId: k.text('user_id').notNull(),
    body: k.text('body').notNull(),
    createdAt: k.time('created_at').notNull(),
  })

  /** One row per publish, so an earlier version can be brought back. */
  const versions = k.table('form_versions', {
    id: k.text('id').primaryKey(),
    formId: k.text('form_id').notNull(),
    version: k.int('version').notNull(),
    schema: k.json('schema').$type<FormSchema>().notNull(),
    publishedAt: k.time('published_at').notNull(),
  })

  /** Every email the app has tried to send. */
  const outbox = k.table('outbox', {
    id: k.text('id').primaryKey(),
    toAddress: k.text('to_address').notNull(),
    subject: k.text('subject').notNull(),
    body: k.text('body').notNull(),
    createdAt: k.time('created_at').notNull(),
    sentAt: k.time('sent_at'),
    error: k.text('error'),
  })

  const passwordResets = k.table('password_resets', {
    /** SHA-256 of the token in the emailed link. */
    id: k.text('id').primaryKey(),
    userId: k.text('user_id').notNull(),
    expiresAt: k.time('expires_at').notNull(),
    usedAt: k.time('used_at'),
  })

  const webhooks = k.table('webhooks', {
    id: k.text('id').primaryKey(),
    formId: k.text('form_id').notNull(),
    url: k.text('url').notNull(),
    /** Used to sign each delivery so the receiver can check it came from us. */
    secret: k.text('secret').notNull(),
    active: k.bool('active').notNull().default(true),
    createdAt: k.time('created_at').notNull(),
  })

  const deliveries = k.table('webhook_deliveries', {
    id: k.text('id').primaryKey(),
    webhookId: k.text('webhook_id').notNull(),
    event: k.text('event').notNull(),
    ok: k.bool('ok').notNull(),
    statusCode: k.int('status_code'),
    error: k.text('error'),
    createdAt: k.time('created_at').notNull(),
  })

  const apiKeys = k.table('api_keys', {
    /** SHA-256 of the key. The key itself is shown once and never stored. */
    id: k.text('id').primaryKey(),
    userId: k.text('user_id').notNull(),
    /** The one workspace this key can read. */
    workspaceId: k.text('workspace_id').notNull(),
    name: k.text('name').notNull(),
    /** The first characters, so the owner can tell keys apart. */
    prefix: k.text('prefix').notNull(),
    createdAt: k.time('created_at').notNull(),
    lastUsedAt: k.time('last_used_at'),
  })

  const files = k.table('files', {
    id: k.text('id').primaryKey(),
    formId: k.text('form_id').notNull(),
    name: k.text('name').notNull(),
    size: k.int('size').notNull(),
    type: k.text('type').notNull(),
    createdAt: k.time('created_at').notNull(),
  })

  return { users, workspaces, members, invites, sessions, forms, submissions, notes, versions, outbox, passwordResets, webhooks, deliveries, apiKeys, files }
}

export const { users, workspaces, members, invites, sessions, forms, submissions, notes, versions, outbox, passwordResets, webhooks, deliveries, apiKeys, files } = defineTables(POSTGRES ? pgKit : sqliteKit)

const MIGRATIONS = [
  `CREATE TABLE users (
     id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
     password_hash TEXT NOT NULL, created_at INTEGER NOT NULL
   );
   CREATE TABLE sessions (
     id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL
   );
   CREATE TABLE forms (
     id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, status TEXT NOT NULL,
     schema TEXT NOT NULL, published_schema TEXT, published_at INTEGER,
     settings TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
   );
   CREATE INDEX forms_owner ON forms(owner_id, updated_at);
   CREATE TABLE submissions (
     id TEXT PRIMARY KEY, form_id TEXT NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
     data TEXT NOT NULL, created_at INTEGER NOT NULL
   );
   CREATE INDEX submissions_form ON submissions(form_id, created_at);`,
  `ALTER TABLE submissions ADD COLUMN status TEXT NOT NULL DEFAULT 'new';
   ALTER TABLE submissions ADD COLUMN updated_at INTEGER;
   CREATE TABLE submission_notes (
     id TEXT PRIMARY KEY, submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
     user_id TEXT NOT NULL, body TEXT NOT NULL, created_at INTEGER NOT NULL
   );
   CREATE INDEX notes_submission ON submission_notes(submission_id, created_at);
   CREATE TABLE form_versions (
     id TEXT PRIMARY KEY, form_id TEXT NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
     version INTEGER NOT NULL, schema TEXT NOT NULL, published_at INTEGER NOT NULL
   );
   CREATE INDEX versions_form ON form_versions(form_id, version);
   CREATE TABLE outbox (
     id TEXT PRIMARY KEY, to_address TEXT NOT NULL, subject TEXT NOT NULL, body TEXT NOT NULL,
     created_at INTEGER NOT NULL, sent_at INTEGER, error TEXT
   );
   CREATE TABLE password_resets (
     id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     expires_at INTEGER NOT NULL, used_at INTEGER
   );
   CREATE TABLE webhooks (
     id TEXT PRIMARY KEY, form_id TEXT NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
     url TEXT NOT NULL, secret TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL
   );
   CREATE TABLE webhook_deliveries (
     id TEXT PRIMARY KEY, webhook_id TEXT NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
     event TEXT NOT NULL, ok INTEGER NOT NULL, status_code INTEGER, error TEXT, created_at INTEGER NOT NULL
   );
   CREATE INDEX deliveries_webhook ON webhook_deliveries(webhook_id, created_at);
   CREATE TABLE api_keys (
     id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     name TEXT NOT NULL, prefix TEXT NOT NULL, created_at INTEGER NOT NULL, last_used_at INTEGER
   );
   CREATE TABLE files (
     id TEXT PRIMARY KEY, form_id TEXT NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
     name TEXT NOT NULL, size INTEGER NOT NULL, type TEXT NOT NULL, created_at INTEGER NOT NULL
   );`,
  // Teams. Every existing account gets a workspace of its own (with the same id as the user,
  // which keeps this step plain SQL) and becomes its owner; its forms and keys move into it.
  `CREATE TABLE workspaces (id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at INTEGER NOT NULL);
   CREATE TABLE members (
     workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
     user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     role TEXT NOT NULL, created_at INTEGER NOT NULL,
     PRIMARY KEY (workspace_id, user_id)
   );
   CREATE INDEX members_user ON members(user_id);
   CREATE TABLE invites (
     id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
     email TEXT NOT NULL, role TEXT NOT NULL, invited_by TEXT NOT NULL,
     expires_at INTEGER NOT NULL, accepted_at INTEGER, created_at INTEGER NOT NULL
   );
   INSERT INTO workspaces (id, name, created_at) SELECT id, name || '''s workspace', created_at FROM users;
   INSERT INTO members (workspace_id, user_id, role, created_at) SELECT id, id, 'owner', created_at FROM users;
   ALTER TABLE forms ADD COLUMN workspace_id TEXT NOT NULL DEFAULT '';
   UPDATE forms SET workspace_id = owner_id;
   CREATE INDEX forms_workspace ON forms(workspace_id, updated_at);
   ALTER TABLE sessions ADD COLUMN workspace_id TEXT;
   ALTER TABLE api_keys ADD COLUMN workspace_id TEXT NOT NULL DEFAULT '';
   UPDATE api_keys SET workspace_id = user_id;`,
]

// PostgreSQL support arrived after the steps above, so it starts from the finished tables.
const PG_MIGRATIONS = [
  `CREATE TABLE users (
     id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
     password_hash TEXT NOT NULL, created_at BIGINT NOT NULL
   );
   CREATE TABLE workspaces (id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at BIGINT NOT NULL);
   CREATE TABLE members (
     workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
     user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     role TEXT NOT NULL, created_at BIGINT NOT NULL,
     PRIMARY KEY (workspace_id, user_id)
   );
   CREATE INDEX members_user ON members(user_id);
   CREATE TABLE invites (
     id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
     email TEXT NOT NULL, role TEXT NOT NULL, invited_by TEXT NOT NULL,
     expires_at BIGINT NOT NULL, accepted_at BIGINT, created_at BIGINT NOT NULL
   );
   CREATE TABLE sessions (
     id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     workspace_id TEXT, expires_at BIGINT NOT NULL, created_at BIGINT NOT NULL
   );
   CREATE TABLE forms (
     id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     workspace_id TEXT NOT NULL, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, status TEXT NOT NULL,
     schema TEXT NOT NULL, published_schema TEXT, published_at BIGINT,
     settings TEXT NOT NULL, created_at BIGINT NOT NULL, updated_at BIGINT NOT NULL
   );
   CREATE INDEX forms_owner ON forms(owner_id, updated_at);
   CREATE INDEX forms_workspace ON forms(workspace_id, updated_at);
   CREATE TABLE submissions (
     id TEXT PRIMARY KEY, form_id TEXT NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
     data TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'new', created_at BIGINT NOT NULL, updated_at BIGINT
   );
   CREATE INDEX submissions_form ON submissions(form_id, created_at);
   CREATE TABLE submission_notes (
     id TEXT PRIMARY KEY, submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
     user_id TEXT NOT NULL, body TEXT NOT NULL, created_at BIGINT NOT NULL
   );
   CREATE INDEX notes_submission ON submission_notes(submission_id, created_at);
   CREATE TABLE form_versions (
     id TEXT PRIMARY KEY, form_id TEXT NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
     version INTEGER NOT NULL, schema TEXT NOT NULL, published_at BIGINT NOT NULL
   );
   CREATE INDEX versions_form ON form_versions(form_id, version);
   CREATE TABLE outbox (
     id TEXT PRIMARY KEY, to_address TEXT NOT NULL, subject TEXT NOT NULL, body TEXT NOT NULL,
     created_at BIGINT NOT NULL, sent_at BIGINT, error TEXT
   );
   CREATE TABLE password_resets (
     id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     expires_at BIGINT NOT NULL, used_at BIGINT
   );
   CREATE TABLE webhooks (
     id TEXT PRIMARY KEY, form_id TEXT NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
     url TEXT NOT NULL, secret TEXT NOT NULL, active BOOLEAN NOT NULL DEFAULT TRUE, created_at BIGINT NOT NULL
   );
   CREATE TABLE webhook_deliveries (
     id TEXT PRIMARY KEY, webhook_id TEXT NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
     event TEXT NOT NULL, ok BOOLEAN NOT NULL, status_code INTEGER, error TEXT, created_at BIGINT NOT NULL
   );
   CREATE INDEX deliveries_webhook ON webhook_deliveries(webhook_id, created_at);
   CREATE TABLE api_keys (
     id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     workspace_id TEXT NOT NULL, name TEXT NOT NULL, prefix TEXT NOT NULL,
     created_at BIGINT NOT NULL, last_used_at BIGINT
   );
   CREATE TABLE files (
     id TEXT PRIMARY KEY, form_id TEXT NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
     name TEXT NOT NULL, size INTEGER NOT NULL, type TEXT NOT NULL, created_at BIGINT NOT NULL
   );`,
]

function openSqlite(path: string) {
  const sqlite = new Database(path)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')
  sqlite.exec('CREATE TABLE IF NOT EXISTS migrations (version INTEGER PRIMARY KEY)')
  const done = (sqlite.prepare('SELECT COALESCE(MAX(version), 0) AS v FROM migrations').get() as { v: number }).v
  MIGRATIONS.slice(done).forEach((sql, i) => {
    sqlite.transaction(() => {
      sqlite.exec(sql)
      sqlite.prepare('INSERT INTO migrations (version) VALUES (?)').run(done + i + 1)
    })()
  })
  return Object.assign(drizzle(sqlite), { close: async () => void sqlite.close() })
}

export type Db = ReturnType<typeof openSqlite>

/** Runs SQL that may hold several statements and returns the last statement's rows. */
type Exec = (sql: string) => Promise<Record<string, unknown>[]>

async function migratePg(exec: Exec) {
  await exec('CREATE TABLE IF NOT EXISTS migrations (version INTEGER PRIMARY KEY)')
  const done = Number((await exec('SELECT COALESCE(MAX(version), 0) AS v FROM migrations'))[0]?.v ?? 0)
  for (let i = done; i < PG_MIGRATIONS.length; i++) {
    // One round trip, so the step and its bookkeeping succeed or fail together.
    await exec(`BEGIN; ${PG_MIGRATIONS[i]}; INSERT INTO migrations (version) VALUES (${i + 1}); COMMIT;`).catch(async (e) => {
      await exec('ROLLBACK').catch(() => {})
      throw e
    })
  }
}

async function openPg(url: string): Promise<Db> {
  if (url.startsWith('pglite:')) {
    // An embedded PostgreSQL. `pglite:` keeps it in memory; `pglite:./folder` keeps it on disk.
    const { PGlite } = await import('@electric-sql/pglite')
    const { drizzle: connect } = await import('drizzle-orm/pglite')
    const client = new PGlite(url.slice('pglite:'.length) || undefined)
    await migratePg(async (sql) => ((await client.exec(sql)).at(-1)?.rows ?? []) as Record<string, unknown>[])
    return Object.assign(connect(client), { close: () => client.close() }) as unknown as Db
  }
  const { default: driver } = await import('pg')
  const { drizzle: connect } = await import('drizzle-orm/node-postgres')
  const pool = new driver.Pool({ connectionString: url })
  await migratePg(async (sql) => {
    const result = (await pool.query(sql)) as unknown as { rows: Record<string, unknown>[] } | { rows: Record<string, unknown>[] }[]
    return (Array.isArray(result) ? result.at(-1)?.rows : result.rows) ?? []
  })
  return Object.assign(connect(pool), { close: () => pool.end() }) as unknown as Db
}

/**
 * Opens the database and brings its tables up to date. Takes a SQLite file path (`:memory:` for
 * a throwaway one) or a `postgres://` address. Which of the two the app speaks is fixed by
 * DATABASE_URL when the process starts, so the address given here has to be of that kind.
 */
export async function createDb(url: string = DATABASE_URL): Promise<Db> {
  if (isPg(url) !== POSTGRES) {
    throw new Error(`This process is set up for ${POSTGRES ? 'PostgreSQL' : 'SQLite'} (from DATABASE_URL), so it cannot open "${url}"`)
  }
  return POSTGRES ? openPg(url) : openSqlite(url)
}

/** The first row of a query, or undefined. */
export const first = async <T>(query: PromiseLike<T[]>): Promise<T | undefined> => (await query)[0]

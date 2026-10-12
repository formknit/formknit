import type { FormSchema } from '@formknit/core'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
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

// Timestamps are milliseconds since 1970 and JSON is stored as text, so the same tables work on PostgreSQL later.
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  createdAt: integer('created_at').notNull(),
})

/** A team's space. Forms belong to a workspace, and people get access by being members of it. */
export const workspaces = sqliteTable('workspaces', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  createdAt: integer('created_at').notNull(),
})

export const members = sqliteTable(
  'members',
  {
    workspaceId: text('workspace_id').notNull(),
    userId: text('user_id').notNull(),
    role: text('role', { enum: ROLES }).notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.workspaceId, t.userId] })],
)

export const invites = sqliteTable('invites', {
  /** SHA-256 of the token in the emailed link. */
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull(),
  email: text('email').notNull(),
  role: text('role', { enum: ROLES }).notNull(),
  invitedBy: text('invited_by').notNull(),
  expiresAt: integer('expires_at').notNull(),
  acceptedAt: integer('accepted_at'),
  createdAt: integer('created_at').notNull(),
})

export const sessions = sqliteTable('sessions', {
  /** SHA-256 of the session token, so a leaked database does not leak usable sessions. */
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  /** The workspace this session is currently working in. */
  workspaceId: text('workspace_id'),
  expiresAt: integer('expires_at').notNull(),
  createdAt: integer('created_at').notNull(),
})

export const forms = sqliteTable('forms', {
  id: text('id').primaryKey(),
  /** Who created the form. Access is decided by the workspace, not by this. */
  ownerId: text('owner_id').notNull(),
  workspaceId: text('workspace_id').notNull(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  status: text('status', { enum: ['draft', 'published'] }).notNull(),
  /** The working copy edited in the builder. */
  schema: text('schema', { mode: 'json' }).$type<FormSchema>().notNull(),
  /** What respondents see. Only changes when the form is published. */
  publishedSchema: text('published_schema', { mode: 'json' }).$type<FormSchema>(),
  publishedAt: integer('published_at'),
  settings: text('settings', { mode: 'json' }).$type<FormSettings>().notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
})

export const submissions = sqliteTable('submissions', {
  id: text('id').primaryKey(),
  formId: text('form_id').notNull(),
  data: text('data', { mode: 'json' }).$type<Record<string, unknown>>().notNull(),
  status: text('status', { enum: STATUSES }).notNull().default('new'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at'),
})

export const notes = sqliteTable('submission_notes', {
  id: text('id').primaryKey(),
  submissionId: text('submission_id').notNull(),
  userId: text('user_id').notNull(),
  body: text('body').notNull(),
  createdAt: integer('created_at').notNull(),
})

/** One row per publish, so an earlier version can be brought back. */
export const versions = sqliteTable('form_versions', {
  id: text('id').primaryKey(),
  formId: text('form_id').notNull(),
  version: integer('version').notNull(),
  schema: text('schema', { mode: 'json' }).$type<FormSchema>().notNull(),
  publishedAt: integer('published_at').notNull(),
})

/** Every email the app has tried to send. */
export const outbox = sqliteTable('outbox', {
  id: text('id').primaryKey(),
  toAddress: text('to_address').notNull(),
  subject: text('subject').notNull(),
  body: text('body').notNull(),
  createdAt: integer('created_at').notNull(),
  sentAt: integer('sent_at'),
  error: text('error'),
})

export const passwordResets = sqliteTable('password_resets', {
  /** SHA-256 of the token in the emailed link. */
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  expiresAt: integer('expires_at').notNull(),
  usedAt: integer('used_at'),
})

export const webhooks = sqliteTable('webhooks', {
  id: text('id').primaryKey(),
  formId: text('form_id').notNull(),
  url: text('url').notNull(),
  /** Used to sign each delivery so the receiver can check it came from us. */
  secret: text('secret').notNull(),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at').notNull(),
})

export const deliveries = sqliteTable('webhook_deliveries', {
  id: text('id').primaryKey(),
  webhookId: text('webhook_id').notNull(),
  event: text('event').notNull(),
  ok: integer('ok', { mode: 'boolean' }).notNull(),
  statusCode: integer('status_code'),
  error: text('error'),
  createdAt: integer('created_at').notNull(),
})

export const apiKeys = sqliteTable('api_keys', {
  /** SHA-256 of the key. The key itself is shown once and never stored. */
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  /** The one workspace this key can read. */
  workspaceId: text('workspace_id').notNull(),
  name: text('name').notNull(),
  /** The first characters, so the owner can tell keys apart. */
  prefix: text('prefix').notNull(),
  createdAt: integer('created_at').notNull(),
  lastUsedAt: integer('last_used_at'),
})

export const files = sqliteTable('files', {
  id: text('id').primaryKey(),
  formId: text('form_id').notNull(),
  name: text('name').notNull(),
  size: integer('size').notNull(),
  type: text('type').notNull(),
  createdAt: integer('created_at').notNull(),
})

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

export type Db = ReturnType<typeof createDb>

/** Opens the database and brings its tables up to date. Pass `:memory:` for tests. */
export function createDb(path: string) {
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
  return Object.assign(drizzle(sqlite), { close: () => sqlite.close() })
}

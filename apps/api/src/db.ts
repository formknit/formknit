import type { FormSchema } from '@formknit/core'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

/** Per-form options that are not part of the schema. */
export interface FormSettings {
  /** Shown to the respondent after a successful submit. */
  successMessage?: string
  /** Stops new submissions without unpublishing the form. */
  closed?: boolean
  maxSubmissions?: number
  /** Field keys other forms may read through lookup fields. Nothing is readable unless listed. */
  exposedFields?: string[]
}

// Timestamps are milliseconds since 1970 and JSON is stored as text, so the same tables work on PostgreSQL later.
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  createdAt: integer('created_at').notNull(),
})

export const sessions = sqliteTable('sessions', {
  /** SHA-256 of the session token, so a leaked database does not leak usable sessions. */
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  expiresAt: integer('expires_at').notNull(),
  createdAt: integer('created_at').notNull(),
})

export const forms = sqliteTable('forms', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id').notNull(),
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

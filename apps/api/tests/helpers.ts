import { createDb, POSTGRES, type Db } from '../src/db'

// Starting the embedded PostgreSQL takes seconds, so each test file starts one and empties it between tests.
let shared: Db | undefined

/** A fresh, empty database of whichever kind this test run is for. */
export async function openTestDb(): Promise<Db> {
  if (!POSTGRES) return createDb(':memory:')
  shared ??= await createDb('pglite:')
  const tables = (await query(shared, "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'migrations'")).map((r) => `"${r.tablename}"`)
  await query(shared, `TRUNCATE ${tables.join(', ')} CASCADE`)
  return Object.assign(Object.create(shared) as Db, { close: async () => undefined })
}

/** Runs plain SQL, for looking at or changing what is stored behind the app's back. */
export async function query(db: Db, sql: string): Promise<Record<string, unknown>[]> {
  const client = (db as any).$client
  if (POSTGRES) return (await client.query(sql)).rows
  const statement = client.prepare(sql)
  if (statement.reader) return statement.all()
  statement.run()
  return []
}

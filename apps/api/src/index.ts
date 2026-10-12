import { serve } from '@hono/node-server'
import { createApp } from './app'
import { createDb } from './db'

const port = Number(process.env.PORT ?? 8787)
const production = process.env.NODE_ENV === 'production'
const db = createDb(process.env.DATABASE_PATH ?? 'formknit.sqlite')
const app = createApp({
  db,
  webOrigins: (process.env.WEB_ORIGIN ?? 'http://localhost:5175').split(',').map((o) => o.trim()),
  secureCookies: production,
})

serve({ fetch: app.fetch, port }, () => console.log(`Formknit API listening on http://localhost:${port}`))

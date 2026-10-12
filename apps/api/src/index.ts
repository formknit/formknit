import { serve } from '@hono/node-server'
import { createApp } from './app'
import { createDb } from './db'
import { createMailer, diskStorage, type Transport } from './services'

const port = Number(process.env.PORT ?? 8787)
const production = process.env.NODE_ENV === 'production'
const db = createDb(process.env.DATABASE_PATH ?? 'formknit.sqlite')

// No email provider is wired up yet. In development each email is printed here (and kept in
// the outbox table) so links such as password resets can be followed. In production, replace
// this with a transport that calls your SMTP server or email provider.
const printToTerminal: Transport = async (mail) => console.log(`\n--- Email to ${mail.to} ---\nSubject: ${mail.subject}\n\n${mail.text}\n---\n`)

const app = createApp({
  db,
  webOrigins: (process.env.WEB_ORIGIN ?? 'http://localhost:5175').split(',').map((o) => o.trim()),
  secureCookies: production,
  mailer: createMailer(db, production ? undefined : printToTerminal),
  storage: diskStorage(process.env.UPLOAD_DIR ?? 'uploads'),
  allowPrivateWebhooks: !production,
})

serve({ fetch: app.fetch, port }, () => console.log(`Formknit API listening on http://localhost:${port}`))

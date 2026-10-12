import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { createApp } from './app'
import { createDb, DATABASE_URL, POSTGRES } from './db'
import { createMailer, diskStorage, type Transport } from './services'

const port = Number(process.env.PORT ?? 8787)
const production = process.env.NODE_ENV === 'production'
const db = await createDb()

// No email provider is wired up yet. In development each email is printed here (and kept in
// the outbox table) so links such as password resets can be followed. In production, replace
// this with a transport that calls your SMTP server or email provider.
const printToTerminal: Transport = async (mail) => console.log(`\n--- Email to ${mail.to} ---\nSubject: ${mail.subject}\n\n${mail.text}\n---\n`)

const webOrigins = (process.env.WEB_ORIGIN ?? 'http://localhost:5175').split(',').map((o) => o.trim())

const app = createApp({
  db,
  webOrigins,
  // Browsers drop "secure" cookies on plain http, so follow the address people actually use.
  secureCookies: webOrigins[0].startsWith('https://'),
  mailer: createMailer(db, production ? undefined : printToTerminal),
  storage: diskStorage(process.env.UPLOAD_DIR ?? 'uploads'),
  allowPrivateWebhooks: !production,
})

// With WEB_DIR set, this one server also hands out the built admin app, so a deployment is a
// single address with no cross-site setup. Unknown pages get index.html so links into the app
// work; a missing file (anything with an extension) stays a 404.
const webDir = process.env.WEB_DIR
const site = new Hono()
site.all('/api/*', (c) => app.fetch(c.req.raw))
if (webDir) {
  site.use('*', serveStatic({ root: webDir }))
  site.get('*', (c, next) => (/\.\w+$/.test(c.req.path) ? next() : serveStatic({ root: webDir, path: 'index.html' })(c, next)))
}

serve({ fetch: site.fetch, port }, () => {
  const where = POSTGRES ? 'PostgreSQL' : `SQLite (${DATABASE_URL})`
  console.log(`Formknit ${webDir ? 'app' : 'API'} listening on http://localhost:${port}, using ${where}`)
})

import { SMTPServer } from 'smtp-server'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../src/app'
import type { Db } from '../src/db'
import { createMailer, smtpTransport, type Mail } from '../src/services'
import { openTestDb, query } from './helpers'

const ORIGIN = 'http://localhost:5175'
const PASSWORD = 'a long enough password'
let db: Db

beforeEach(async () => {
  db = await openTestDb()
})
afterEach(() => db.close())

function client(app: ReturnType<typeof createApp>) {
  let cookie = ''
  const call = async (method: string, path: string, body?: unknown) => {
    const res = await app.request(path, {
      method,
      headers: { origin: ORIGIN, cookie, ...(body ? { 'content-type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    })
    cookie = res.headers.get('set-cookie')?.split(';')[0] ?? cookie
    return { status: res.status, json: (await res.json()) as any }
  }
  return { get: (p: string) => call('GET', p), post: (p: string, b?: unknown) => call('POST', p, b) }
}

describe('invitation-only sign-up', () => {
  it('lets the first account in, then only people with an invitation', async () => {
    const sent: Mail[] = []
    const app = createApp({ db, webOrigins: [ORIGIN], registration: 'invite', mailer: async (m) => void sent.push(m) })
    const owner = client(app)
    expect((await owner.get('/api/auth/config')).json).toEqual({ registration: 'open' })
    expect((await owner.post('/api/auth/register', { name: 'Owner', email: 'owner@example.com', password: PASSWORD })).status).toBe(201)
    expect((await owner.get('/api/auth/config')).json).toEqual({ registration: 'invite' })

    const stranger = client(app)
    const refused = await stranger.post('/api/auth/register', { name: 'Stranger', email: 'stranger@example.com', password: PASSWORD })
    expect(refused.status).toBe(403)
    expect(refused.json.error.code).toBe('registration_closed')

    expect((await owner.post('/api/workspace/invites', { email: 'guest@example.com', role: 'editor' })).status).toBe(201)
    await app.idle()
    const token = /token=([\w-]+)/.exec(sent[0].text)![1]

    // The invitation is for one address only, and a made-up token is no use.
    expect((await stranger.post('/api/auth/register', { name: 'Stranger', email: 'stranger@example.com', password: PASSWORD, invite: token })).status).toBe(403)
    expect((await stranger.post('/api/auth/register', { name: 'Guest', email: 'guest@example.com', password: PASSWORD, invite: 'nope' })).status).toBe(403)

    const guest = client(app)
    expect((await guest.post('/api/auth/register', { name: 'Guest', email: 'guest@example.com', password: PASSWORD, invite: token })).status).toBe(201)
    expect((await guest.post('/api/invites/accept', { token })).status).toBe(200)
    // Once used, the same invitation cannot create another account.
    await query(db, "UPDATE users SET email = 'moved@example.com' WHERE email = 'guest@example.com'")
    expect((await client(app).post('/api/auth/register', { name: 'Again', email: 'guest@example.com', password: PASSWORD, invite: token })).status).toBe(403)
  })

  it('stays open by default', async () => {
    const app = createApp({ db, webOrigins: [ORIGIN] })
    expect((await client(app).post('/api/auth/register', { name: 'A', email: 'a@example.com', password: PASSWORD })).status).toBe(201)
    expect((await client(app).post('/api/auth/register', { name: 'B', email: 'b@example.com', password: PASSWORD })).status).toBe(201)
    expect((await client(app).get('/api/auth/config')).json).toEqual({ registration: 'open' })
  })
})

describe('sending email through SMTP', () => {
  it('delivers to a mail server and records the result', async () => {
    const received: { from: string; to: string[]; body: string }[] = []
    const server = new SMTPServer({
      authOptional: true,
      disabledCommands: ['STARTTLS'],
      onData(stream, session, done) {
        let body = ''
        stream.on('data', (chunk) => (body += chunk))
        stream.on('end', () => {
          received.push({ from: session.envelope.mailFrom ? session.envelope.mailFrom.address : '', to: session.envelope.rcptTo.map((r) => r.address), body })
          done()
        })
      },
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const port = (server.server.address() as { port: number }).port
    try {
      const mail = createMailer(db, smtpTransport(`smtp://127.0.0.1:${port}`, 'Formknit <forms@example.com>'))
      await mail({ to: 'sita@example.com', subject: 'Reset your password', text: 'Open this link: https://forms.example.com/reset?token=abc' })
      expect(received).toHaveLength(1)
      expect(received[0].from).toBe('forms@example.com')
      expect(received[0].to).toEqual(['sita@example.com'])
      expect(received[0].body).toContain('Subject: Reset your password')
      expect(received[0].body).toContain('https://forms.example.com/reset')
      expect(Number((await query(db, 'SELECT COUNT(*) AS n FROM outbox WHERE sent_at IS NOT NULL AND error IS NULL'))[0].n)).toBe(1)
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  })

  it('records the failure when the server cannot be reached', async () => {
    const mail = createMailer(db, smtpTransport('smtp://127.0.0.1:1', 'forms@example.com'))
    await mail({ to: 'sita@example.com', subject: 'Hello', text: 'Hi' })
    const rows = await query(db, 'SELECT sent_at, error FROM outbox')
    expect(rows[0].sent_at).toBeNull()
    expect(String(rows[0].error)).not.toBe('')
  })
})

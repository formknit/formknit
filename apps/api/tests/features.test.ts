import { calculated, checkbox, field, form, number, radio, rating, text, type FormSchema } from '@formknit/core'
import { createHmac } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../src/app'
import type { Db } from '../src/db'
import { openTestDb, query } from './helpers'
import { createMailer, memoryStorage, webhookUrlProblem, type Mail } from '../src/services'

const ORIGIN = 'http://localhost:5175'
const PASSWORD = 'a-long-test-password'
let db: Db
let app: ReturnType<typeof createApp>
let sent: Mail[]
let calls: { url: string; headers: Record<string, string>; body: string }[]
let hookStatus: number
let storage: ReturnType<typeof memoryStorage>

beforeEach(async () => {
  db = await openTestDb()
  sent = []
  calls = []
  hookStatus = 200
  storage = memoryStorage()
  app = createApp({
    db,
    webOrigins: [ORIGIN],
    storage,
    mailer: createMailer(db, async (mail) => void sent.push(mail)),
    fetcher: (async (url: string, init: RequestInit) => {
      calls.push({ url, headers: init.headers as Record<string, string>, body: String(init.body) })
      return new Response('', { status: hookStatus })
    }) as unknown as typeof fetch,
  })
})
afterEach(() => db.close())

function client(ip = '10.0.0.1') {
  let cookie = ''
  const call = async (method: string, path: string, body?: unknown, headers: Record<string, string> = {}) => {
    const form = body instanceof FormData
    const res = await app.request(path, {
      method,
      headers: { ...(form ? {} : { 'content-type': 'application/json' }), origin: ORIGIN, 'x-forwarded-for': ip, ...(cookie ? { cookie } : {}), ...headers },
      body: body === undefined ? undefined : form ? body : JSON.stringify(body),
    })
    const set = res.headers.get('set-cookie')
    if (set) cookie = set.split(';')[0]
    const bytes = new Uint8Array(await res.arrayBuffer())
    const text = new TextDecoder().decode(bytes)
    let json: any = null
    try {
      json = JSON.parse(text)
    } catch {
      // Not JSON.
    }
    return { status: res.status, json, text, bytes, headers: res.headers }
  }
  return {
    get: (path: string, headers?: Record<string, string>) => call('GET', path, undefined, headers),
    post: (path: string, body?: unknown, headers?: Record<string, string>) => call('POST', path, body ?? {}, headers),
    patch: (path: string, body: unknown) => call('PATCH', path, body),
    del: (path: string) => call('DELETE', path),
    clear: () => (cookie = ''),
  }
}

async function signedIn(email = 'sita@example.com') {
  const c = client()
  expect((await c.post('/api/auth/register', { name: 'Sita', email, password: PASSWORD })).status).toBe(201)
  return c
}

const survey = form('Survey', [
  text('name').label('Name').required(),
  radio('plan', { free: 'Free', pro: 'Pro' }).label('Plan'),
  rating('stars').label('Stars'),
  number('spend').label('Spend'),
  calculated('double', 'spend * 2').label('Double'),
  checkbox('agree').label('Agree'),
])

async function published(c: ReturnType<typeof client>, schema: FormSchema = survey, name = 'Survey') {
  const created = (await c.post('/api/forms', { name, schema })).json.form
  expect((await c.post(`/api/forms/${created.id}/publish`)).status).toBe(200)
  return created as { id: string; slug: string }
}
const submit = (slug: string, data: unknown, ip = '10.5.0.1') => client(ip).post(`/api/public/forms/${slug}/submissions`, data)

describe('password reset and account settings', () => {
  it('emails a one-time link, changes the password and signs out old sessions', async () => {
    const c = await signedIn()
    const stranger = client('10.0.0.9')
    expect((await stranger.post('/api/auth/forgot', { email: 'nobody@example.com' })).json).toEqual({ ok: true })
    expect((await stranger.post('/api/auth/forgot', { email: 'SITA@example.com' })).json).toEqual({ ok: true })
    await app.idle()
    expect(sent).toHaveLength(1)
    expect(sent[0]).toMatchObject({ to: 'sita@example.com', subject: 'Reset your Formknit password' })
    const token = sent[0].text.match(/reset\?token=([\w-]+)/)![1]
    expect(JSON.stringify(await query(db, 'SELECT * FROM password_resets'))).not.toContain(token)

    expect((await stranger.post('/api/auth/reset', { token, password: 'short' })).status).toBe(422)
    expect((await stranger.post('/api/auth/reset', { token: 'wrong', password: 'another-long-password' })).status).toBe(400)
    expect((await stranger.post('/api/auth/reset', { token, password: 'another-long-password' })).status).toBe(200)
    expect((await stranger.post('/api/auth/reset', { token, password: 'yet-another-password' })).status).toBe(400)

    expect((await c.get('/api/forms')).status).toBe(401)
    expect((await stranger.post('/api/auth/login', { email: 'sita@example.com', password: PASSWORD })).status).toBe(401)
    expect((await stranger.post('/api/auth/login', { email: 'sita@example.com', password: 'another-long-password' })).status).toBe(200)
  })

  it('rejects an expired link', async () => {
    await signedIn()
    await client().post('/api/auth/forgot', { email: 'sita@example.com' })
    await app.idle()
    const token = sent[0].text.match(/reset\?token=([\w-]+)/)![1]
    await query(db, 'UPDATE password_resets SET expires_at = 1')
    expect((await client().post('/api/auth/reset', { token, password: 'another-long-password' })).status).toBe(400)
  })

  it('changes the name and password from account settings', async () => {
    const c = await signedIn()
    const other = client('10.0.0.3')
    await other.post('/api/auth/login', { email: 'sita@example.com', password: PASSWORD })
    expect((await c.patch('/api/auth/profile', { name: 'Sita Sharma' })).json.user.name).toBe('Sita Sharma')
    expect((await c.post('/api/auth/password', { currentPassword: 'wrong', newPassword: 'brand-new-password' })).json.error.fields).toHaveProperty('currentPassword')
    expect((await c.post('/api/auth/password', { currentPassword: PASSWORD, newPassword: 'short' })).json.error.fields).toHaveProperty('newPassword')
    expect((await c.post('/api/auth/password', { currentPassword: PASSWORD, newPassword: 'brand-new-password' })).status).toBe(200)
    expect((await c.get('/api/auth/me')).json.user.name).toBe('Sita Sharma')
    expect((await other.get('/api/forms')).status).toBe(401)
  })
})

describe('API keys', () => {
  it('reads with a key, cannot write, and stops working once deleted', async () => {
    const c = await signedIn()
    const f = await published(c)
    const created = (await c.post('/api/api-keys', { name: 'Reporting' })).json
    expect(created.key).toMatch(/^fk_/)
    const listed = (await c.get('/api/api-keys')).json.keys
    expect(listed).toHaveLength(1)
    expect(JSON.stringify(listed)).not.toContain(created.key)
    expect(JSON.stringify(await query(db, 'SELECT * FROM api_keys'))).not.toContain(created.key)

    const robot = client('10.0.0.7')
    const auth = { authorization: `Bearer ${created.key}` }
    expect((await robot.get('/api/forms', auth)).json.forms).toHaveLength(1)
    expect((await robot.get(`/api/forms/${f.id}/submissions`, auth)).status).toBe(200)
    expect((await robot.post('/api/forms', { name: 'X' }, auth)).status).toBe(403)
    expect((await robot.get('/api/api-keys', auth)).status).toBe(403)
    expect((await robot.get('/api/forms', { authorization: 'Bearer fk_made_up' })).status).toBe(401)
    expect((await c.get('/api/api-keys')).json.keys[0].lastUsedAt).toBeGreaterThan(0)

    await c.del(`/api/api-keys/${listed[0].id}`)
    expect((await robot.get('/api/forms', auth)).status).toBe(401)
  })
})

describe('templates, duplicates and versions', () => {
  it('starts a form from a template', async () => {
    const c = await signedIn()
    const list = (await c.get('/api/templates')).json.templates
    expect(list.map((t: any) => t.id)).toEqual(['contact', 'admission', 'event', 'feedback', 'invoice'])
    const made = (await c.post('/api/forms', { template: 'invoice', name: 'March invoice' })).json.form
    expect(made).toMatchObject({ name: 'March invoice', slug: 'march-invoice', issues: [] })
    expect(made.schema.title).toBe('March invoice')
    expect(made.schema.pages[0].components.map((x: any) => x.key)).toContain('items')
    expect((await c.post(`/api/forms/${made.id}/publish`)).status).toBe(200)
    expect((await c.post('/api/forms', { template: 'nope' })).status).toBe(422)
  })

  it('duplicates a form as a private draft', async () => {
    const c = await signedIn()
    const f = await published(c)
    await c.patch(`/api/forms/${f.id}`, { settings: { successMessage: 'Thanks', exposedFields: ['name'] } })
    await submit(f.slug, { name: 'A' })
    const copy = (await c.post(`/api/forms/${f.id}/duplicate`)).json.form
    expect(copy).toMatchObject({ name: 'Survey (copy)', slug: 'survey-copy', status: 'draft', submissions: 0, settings: { successMessage: 'Thanks' } })
    expect(copy.settings).not.toHaveProperty('exposedFields')
    expect(copy.schema).toEqual(survey)
  })

  it('keeps each published version and restores one into the draft', async () => {
    const c = await signedIn()
    const f = await published(c)
    await c.post(`/api/forms/${f.id}/publish`)
    expect((await c.get(`/api/forms/${f.id}/versions`)).json.versions).toHaveLength(1)

    const v2 = form('Survey', [text('name').label('Name'), text('extra').label('Extra')])
    await c.patch(`/api/forms/${f.id}`, { schema: v2 })
    await c.post(`/api/forms/${f.id}/publish`)
    const list = (await c.get(`/api/forms/${f.id}/versions`)).json.versions
    expect(list.map((v: any) => [v.version, v.fields, v.live])).toEqual([[2, 2, true], [1, 6, false]])

    const restored = (await c.post(`/api/forms/${f.id}/versions/${list[1].id}/restore`)).json.form
    expect(restored.schema).toEqual(survey)
    expect(restored.unpublishedChanges).toBe(true)
    // Respondents still see version 2 until it is published.
    expect(((await (await app.request(`/api/public/forms/${f.slug}`)).json()) as any).schema).toEqual(v2)
    await c.post(`/api/forms/${f.id}/publish`)
    expect((await c.get(`/api/forms/${f.id}/versions`)).json.versions.map((v: any) => v.version)).toEqual([3, 2, 1])
    expect((await c.post(`/api/forms/${f.id}/versions/nope/restore`)).status).toBe(404)
  })
})

describe('opening times and settings', () => {
  it('opens and closes on schedule, and changes only the settings that were sent', async () => {
    const c = await signedIn()
    const f = await published(c)
    const soon = new Date(Date.now() + 3600000).toISOString()
    const past = new Date(Date.now() - 3600000).toISOString()
    await c.patch(`/api/forms/${f.id}`, { settings: { successMessage: 'Thanks' } })

    expect((await c.patch(`/api/forms/${f.id}`, { settings: { opensAt: soon } })).json.form.settings).toEqual({ successMessage: 'Thanks', opensAt: soon })
    expect(((await (await app.request(`/api/public/forms/${f.slug}`)).json()) as any)).toMatchObject({ closed: true, reason: 'not_open', opensAt: soon })
    expect((await submit(f.slug, { name: 'A' })).status).toBe(403)

    await c.patch(`/api/forms/${f.id}`, { settings: { opensAt: '', closesAt: past } })
    expect(((await (await app.request(`/api/public/forms/${f.slug}`)).json()) as any).reason).toBe('ended')
    expect((await c.get('/api/forms')).json.forms[0].closedReason).toBe('ended')

    await c.patch(`/api/forms/${f.id}`, { settings: { closesAt: '' } })
    expect((await submit(f.slug, { name: 'A' })).status).toBe(201)
    expect((await c.patch(`/api/forms/${f.id}`, { settings: { opensAt: 'whenever' } })).json.error.fields).toHaveProperty('opensAt')
    expect((await c.patch(`/api/forms/${f.id}`, { settings: { opensAt: soon, closesAt: past } })).json.error.fields).toHaveProperty('closesAt')
  })
})

describe('review workflow', () => {
  it('changes status, filters by it, keeps notes and edits answers', async () => {
    const c = await signedIn()
    const f = await published(c)
    const a = (await submit(f.slug, { name: 'Sita', spend: 10 }, '10.6.0.1')).json.id
    const b = (await submit(f.slug, { name: 'Arjun', spend: 20 }, '10.6.0.2')).json.id

    expect((await c.get(`/api/submissions/${a}`)).json.submission.status).toBe('new')
    expect((await c.patch(`/api/submissions/${a}`, { status: 'approved' })).json.submission.status).toBe('approved')
    expect((await c.patch(`/api/submissions/${a}`, { status: 'nonsense' })).status).toBe(422)
    expect((await c.get(`/api/forms/${f.id}/submissions?status=approved`)).json.submissions.map((s: any) => s.id)).toEqual([a])
    expect((await c.get(`/api/forms/${f.id}/submissions?status=new`)).json.submissions.map((s: any) => s.id)).toEqual([b])

    expect((await c.post(`/api/submissions/${a}/notes`, { body: '  ' })).status).toBe(422)
    await c.post(`/api/submissions/${a}/notes`, { body: 'Documents checked' })
    const detail = (await c.get(`/api/submissions/${a}`)).json
    expect(detail.notes).toMatchObject([{ body: 'Documents checked', author: 'Sita' }])
    expect(detail.schema).toEqual(survey)

    // Edits are validated and formulas recalculated, like a new submission.
    expect((await c.patch(`/api/submissions/${a}`, { data: { name: '', spend: 5 } })).json.error.fields).toEqual({ name: ['Name is required'] })
    const edited = (await c.patch(`/api/submissions/${a}`, { data: { name: 'Sita Sharma', spend: 50, double: 1, hacker: true } })).json.submission
    expect(edited.data).toMatchObject({ name: 'Sita Sharma', spend: 50, double: 100 })
    expect(edited.data).not.toHaveProperty('hacker')
    expect(edited.status).toBe('approved')

    const csv = (await c.get(`/api/forms/${f.id}/submissions.csv`)).text
    expect(csv.split('\r\n')[0]).toBe('Submitted,ID,Name,Plan,Stars,Spend,Double,Agree,Status')
    expect(csv).toContain('approved')

    const other = await signedIn('other@example.com')
    expect((await other.patch(`/api/submissions/${a}`, { status: 'rejected' })).status).toBe(404)
    expect((await other.post(`/api/submissions/${a}/notes`, { body: 'x' })).status).toBe(404)
  })
})

describe('dashboard and reports', () => {
  it('summarises forms and answers', async () => {
    const c = await signedIn()
    const f = await published(c)
    await c.post('/api/forms', { name: 'Draft only' })
    const answers = [
      { name: 'A', plan: 'pro', stars: 5, spend: 100, agree: true },
      { name: 'B', plan: 'pro', stars: 3, spend: 50, agree: false },
      { name: 'C', plan: 'free', spend: 0.1 },
      { name: 'D' },
    ]
    const ids: string[] = []
    for (const [i, a] of answers.entries()) ids.push((await submit(f.slug, a, `10.7.0.${i}`)).json.id)
    await c.patch(`/api/submissions/${ids[0]}`, { status: 'approved' })

    const dash = (await c.get('/api/dashboard')).json
    expect(dash).toMatchObject({ forms: 2, published: 1, submissions: 4, thisWeek: 4, awaitingReview: 3 })
    expect(dash.series).toHaveLength(14)
    expect(dash.series[13].count).toBe(4)
    expect(dash.recent[0]).toMatchObject({ formName: 'Survey' })
    expect(dash.topForms[0]).toMatchObject({ name: 'Survey', submissions: 4 })

    const report = (await c.get(`/api/forms/${f.id}/report`)).json.report
    expect(report.total).toBe(4)
    expect(report.byStatus).toEqual({ new: 3, in_review: 0, approved: 1, rejected: 0 })
    expect(report.series).toHaveLength(30)
    const byKey = Object.fromEntries(report.fields.map((x: any) => [x.key, x]))
    expect(byKey.plan).toMatchObject({ kind: 'choices', answered: 3, counts: [{ label: 'Free', count: 1 }, { label: 'Pro', count: 2 }] })
    expect(byKey.agree.counts).toEqual([{ label: 'Yes', count: 1 }, { label: 'No', count: 3 }])
    expect(byKey.stars).toMatchObject({ kind: 'numbers', answered: 2, average: 4, min: 3, max: 5 })
    expect(byKey.spend).toMatchObject({ answered: 3, sum: 150.1, min: 0.1, max: 100 })
    expect(byKey.double).toMatchObject({ sum: 300.2 })
    expect(byKey).not.toHaveProperty('name')

    const other = await signedIn('other@example.com')
    expect((await other.get('/api/dashboard')).json).toMatchObject({ forms: 0, submissions: 0 })
    expect((await other.get(`/api/forms/${f.id}/report`)).status).toBe(404)
  })
})

describe('email notifications and webhooks', () => {
  it('emails the listed addresses when a submission arrives', async () => {
    const c = await signedIn()
    const f = await published(c)
    expect((await c.patch(`/api/forms/${f.id}`, { settings: { notifyEmails: 'office@example.com, bad' } })).json.error.fields).toHaveProperty('notifyEmails')
    expect((await c.patch(`/api/forms/${f.id}`, { settings: { notifyEmails: 'Office@example.com; head@example.com office@example.com' } })).json.form.settings.notifyEmails).toEqual(['office@example.com', 'head@example.com'])
    const id = (await submit(f.slug, { name: 'Sita', plan: 'pro' })).json.id
    await app.idle()
    expect(sent.map((m) => m.to)).toEqual(['office@example.com', 'head@example.com'])
    expect(sent[0].subject).toBe('New submission: Survey')
    expect(sent[0].text).toContain('Name: Sita')
    expect(sent[0].text).toContain(`${ORIGIN}/submissions/${id}`)
    expect(Number((await query(db, 'SELECT COUNT(*) AS n FROM outbox WHERE sent_at IS NOT NULL'))[0].n)).toBe(2)
  })

  it('calls webhooks with a signature, records each delivery and reports failures', async () => {
    const c = await signedIn()
    const f = await published(c)
    expect((await c.post(`/api/forms/${f.id}/webhooks`, { url: 'http://localhost:9000/hook' })).json.error.fields).toHaveProperty('url')
    expect((await c.post(`/api/forms/${f.id}/webhooks`, { url: 'not a url' })).status).toBe(422)
    const hook = (await c.post(`/api/forms/${f.id}/webhooks`, { url: 'https://hooks.example.com/formknit' })).json.webhook
    expect(hook.secret).toMatch(/^whsec_/)

    const id = (await submit(f.slug, { name: 'Sita', spend: 4 })).json.id
    await app.idle()
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe('https://hooks.example.com/formknit')
    const payload = JSON.parse(calls[0].body)
    expect(payload).toMatchObject({ event: 'submission.created', form: { slug: f.slug }, submission: { id, status: 'new', data: { name: 'Sita', double: 8 } } })
    expect(calls[0].headers['x-formknit-signature']).toBe(`sha256=${createHmac('sha256', hook.secret).update(calls[0].body).digest('hex')}`)

    await c.patch(`/api/submissions/${id}`, { status: 'approved' })
    await app.idle()
    expect(JSON.parse(calls[1].body)).toMatchObject({ event: 'submission.status_changed', submission: { status: 'approved' } })

    hookStatus = 500
    expect((await c.post(`/api/forms/${f.id}/webhooks/${hook.id}/test`)).json.result).toMatchObject({ ok: false, statusCode: 500 })
    expect((await c.get(`/api/forms/${f.id}/webhooks`)).json.webhooks[0].last).toMatchObject({ ok: false, event: 'webhook.test', error: 'The receiver answered 500' })

    await c.patch(`/api/forms/${f.id}/webhooks/${hook.id}`, { active: false })
    await submit(f.slug, { name: 'B' }, '10.8.0.2')
    await app.idle()
    expect(calls).toHaveLength(3)
    expect((await c.del(`/api/forms/${f.id}/webhooks/${hook.id}`)).status).toBe(200)
    expect((await c.get(`/api/forms/${f.id}/webhooks`)).json.webhooks).toEqual([])

    const other = await signedIn('other@example.com')
    expect((await other.get(`/api/forms/${f.id}/webhooks`)).status).toBe(404)
  })

  it('refuses webhook addresses on private networks', () => {
    for (const url of ['http://example.com/x', 'https://localhost/x', 'https://127.0.0.1/x', 'https://10.1.2.3/x', 'https://192.168.1.5/x', 'https://172.20.0.1/x', 'https://169.254.169.254/latest', 'https://[::1]/x', 'https://db.internal/x', 'https://user:pw@example.com/x', 'ftp://example.com/x']) {
      expect(webhookUrlProblem(url, false), url).not.toBeNull()
    }
    expect(webhookUrlProblem('https://hooks.example.com/x', false)).toBeNull()
    expect(webhookUrlProblem('https://8.8.8.8/x', false)).toBeNull()
    expect(webhookUrlProblem('http://localhost:9000/x', true)).toBeNull()
  })
})

describe('file uploads', () => {
  const withFile = form('Application', [text('name').label('Name'), field('file', 'cv', { label: 'CV', accept: '.pdf', validate: { maxSizeMb: 1 } })])
  const upload = (slug: string, file: File, fieldKey = 'cv') => {
    const data = new FormData()
    data.set('file', file)
    return client('10.9.0.1').post(`/api/public/forms/${slug}/files?field=${fieldKey}`, data)
  }

  it('stores a file for a real file field and lets only the owner download it', async () => {
    const c = await signedIn()
    const f = await published(c, withFile, 'Application')
    const res = await upload(f.slug, new File(['%PDF-1.4 hello'], '../../cv.pdf', { type: 'application/pdf' }))
    expect(res.status).toBe(201)
    expect(res.json).toMatchObject({ name: '.._.._cv.pdf', size: 14, url: `/api/files/${res.json.id}` })
    expect(storage.items.size).toBe(1)

    const download = await c.get(res.json.url)
    expect(download.status).toBe(200)
    expect(new TextDecoder().decode(download.bytes)).toBe('%PDF-1.4 hello')
    expect(download.headers.get('content-disposition')).toMatch(/^attachment/)
    expect(download.headers.get('content-type')).toBe('application/octet-stream')
    expect(download.headers.get('x-content-type-options')).toBe('nosniff')

    expect((await client().get(res.json.url)).status).toBe(401)
    expect((await (await signedIn('other@example.com')).get(res.json.url)).status).toBe(404)

    await c.del(`/api/forms/${f.id}`)
    expect(storage.items.size).toBe(0)
  })

  it('rejects the wrong type, an oversized file, and uploads to anything that is not a file field', async () => {
    const f = await published(await signedIn(), withFile, 'Application')
    expect((await upload(f.slug, new File(['<script>'], 'page.html', { type: 'text/html' }))).status).toBe(422)
    expect((await upload(f.slug, new File([new Uint8Array(1024 * 1024 + 1)], 'big.pdf', { type: 'application/pdf' }))).status).toBe(413)
    expect((await upload(f.slug, new File(['x'], 'a.pdf', { type: 'application/pdf' }), 'name')).status).toBe(400)
    expect((await upload(f.slug, new File(['x'], 'a.pdf', { type: 'application/pdf' }), 'nope')).status).toBe(400)
    expect((await upload('unknown-form', new File(['x'], 'a.pdf'))).status).toBe(404)
    expect(storage.items.size).toBe(0)
  })
})

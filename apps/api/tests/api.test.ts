import { calculated, checkbox, form, lookup, number, select, text, type FormSchema } from '@formknit/core'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../src/app'
import type { Db } from '../src/db'
import { openTestDb, query } from './helpers'

const ORIGIN = 'http://localhost:5175'
let db: Db
let app: ReturnType<typeof createApp>

beforeEach(async () => {
  db = await openTestDb()
  app = createApp({ db, webOrigins: [ORIGIN] })
})
afterEach(() => db.close())

/** A browser-like client that keeps its session cookie. */
function client(ip = '10.0.0.1') {
  let cookie = ''
  const call = async (method: string, path: string, body?: unknown, headers: Record<string, string> = {}) => {
    const res = await app.request(path, {
      method,
      headers: { 'content-type': 'application/json', origin: ORIGIN, 'x-forwarded-for': ip, ...(cookie ? { cookie } : {}), ...headers },
      body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    })
    const set = res.headers.get('set-cookie')
    if (set) cookie = set.split(';')[0]
    const text = await res.text()
    let json: any = null
    try {
      json = JSON.parse(text)
    } catch {
      // Not JSON (e.g. the CSV export).
    }
    return { status: res.status, json, text, headers: res.headers }
  }
  return {
    get: (path: string) => call('GET', path),
    post: (path: string, body?: unknown, headers?: Record<string, string>) => call('POST', path, body ?? {}, headers),
    patch: (path: string, body: unknown) => call('PATCH', path, body),
    del: (path: string) => call('DELETE', path),
    setCookie: (value: string) => (cookie = value),
    get cookie() {
      return cookie
    },
  }
}

const PASSWORD = 'a-long-test-password'
async function signedIn(email = 'sita@example.com') {
  const c = client()
  const res = await c.post('/api/auth/register', { name: 'Sita', email, password: PASSWORD })
  expect(res.status).toBe(201)
  return c
}

const admission = form('Admission', [
  text('fullName').label('Full name').required(),
  select('country', { NP: 'Nepal', IN: 'India' }).label('Country').required(),
  text('district').label('District').visibleWhen('country == "NP"').required(),
  number('fee').label('Fee'),
  calculated('withVat', 'ROUND(fee * 1.13, 2)').label('With VAT'),
  checkbox('agree').label('Agree').required(),
])

async function published(c: ReturnType<typeof client>, schema: FormSchema = admission, name = 'Admission form') {
  const created = await c.post('/api/forms', { name, schema })
  expect(created.status).toBe(201)
  const pub = await c.post(`/api/forms/${created.json.form.id}/publish`)
  expect(pub.status).toBe(200)
  return created.json.form as { id: string; slug: string }
}

describe('accounts', () => {
  it('registers, signs out and signs in', async () => {
    const c = await signedIn()
    expect(c.cookie).toMatch(/^fk_session=/)
    expect((await c.get('/api/auth/me')).json.user).toMatchObject({ email: 'sita@example.com', name: 'Sita' })
    await c.post('/api/auth/logout')
    expect((await c.get('/api/auth/me')).json.user).toBeNull()
    expect((await c.get('/api/forms')).status).toBe(401)

    expect((await c.post('/api/auth/login', { email: 'SITA@example.com', password: 'wrong-password-123' })).status).toBe(401)
    expect((await c.post('/api/auth/login', { email: 'nobody@example.com', password: PASSWORD })).json.error.message).toBe('The email or password is not correct')
    expect((await c.post('/api/auth/login', { email: 'SITA@example.com', password: PASSWORD })).status).toBe(200)
    expect((await c.get('/api/forms')).status).toBe(200)
  })

  it('validates registration and refuses a duplicate email', async () => {
    const c = client()
    const bad = await c.post('/api/auth/register', { name: '', email: 'nope', password: 'short' })
    expect(bad.status).toBe(422)
    expect(Object.keys(bad.json.error.fields).sort()).toEqual(['email', 'name', 'password'])
    await signedIn('dup@example.com')
    expect((await c.post('/api/auth/register', { name: 'X', email: 'DUP@example.com', password: PASSWORD })).status).toBe(409)
  })

  it('stores neither the password nor the session token in plain form', async () => {
    const c = await signedIn()
    const dump = JSON.stringify(await query(db, 'SELECT * FROM users')) + JSON.stringify(await query(db, 'SELECT * FROM sessions'))
    expect(dump).not.toContain(PASSWORD)
    expect(dump).not.toContain(c.cookie.split('=')[1])
    expect(dump).toContain('scrypt$')
  })

  it('sets a cookie scripts cannot read, and rejects forged or expired sessions', async () => {
    const res = await app.request('/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: ORIGIN },
      body: JSON.stringify({ name: 'A', email: 'a@example.com', password: PASSWORD }),
    })
    expect(res.headers.get('set-cookie')).toMatch(/HttpOnly/)
    expect(res.headers.get('set-cookie')).toMatch(/SameSite=Lax/)
    const c = client()
    c.setCookie('fk_session=made-up-token')
    expect((await c.get('/api/forms')).status).toBe(401)
    const real = await signedIn('b@example.com')
    await query(db, 'UPDATE sessions SET expires_at = 1')
    expect((await real.get('/api/forms')).status).toBe(401)
  })

  it('limits repeated sign-in attempts', async () => {
    await signedIn()
    const c = client('10.9.9.9')
    let last = 0
    for (let i = 0; i < 11; i++) last = (await c.post('/api/auth/login', { email: 'sita@example.com', password: 'wrong-password-123' })).status
    expect(last).toBe(429)
    expect((await c.post('/api/auth/login', { email: 'sita@example.com', password: PASSWORD })).status).toBe(429)
  })

  it('refuses changes sent from another website', async () => {
    const c = await signedIn()
    const res = await c.post('/api/forms', { name: 'X' }, { origin: 'https://evil.example' })
    expect(res.status).toBe(403)
    expect((await c.get('/api/forms')).json.forms).toEqual([])
  })
})

describe('forms', () => {
  it('creates, edits, publishes and deletes a form', async () => {
    const c = await signedIn()
    const created = (await c.post('/api/forms', { name: 'Admission Form 2027!' })).json.form
    expect(created).toMatchObject({ name: 'Admission Form 2027!', slug: 'admission-form-2027', status: 'draft', submissions: 0 })
    expect(created.schema.pages).toHaveLength(1)
    expect((await c.post('/api/forms', { name: 'Admission Form 2027!' })).json.form.slug).toBe('admission-form-2027-2')

    expect((await app.request(`/api/public/forms/${created.slug}`)).status).toBe(404)
    const patched = await c.patch(`/api/forms/${created.id}`, { schema: admission, slug: 'apply', settings: { successMessage: 'Thanks!', maxSubmissions: '2', junk: 1 } })
    expect(patched.json.form).toMatchObject({ slug: 'apply', settings: { successMessage: 'Thanks!', maxSubmissions: 2 }, issues: [] })
    expect(patched.json.form.settings).not.toHaveProperty('junk')

    expect((await c.post(`/api/forms/${created.id}/publish`)).json.form).toMatchObject({ status: 'published', unpublishedChanges: false })
    const pub = await app.request('/api/public/forms/apply')
    expect(((await pub.json()) as any).schema.title).toBe('Admission')

    // Edits stay private until published again.
    await c.patch(`/api/forms/${created.id}`, { schema: { ...admission, title: 'Changed' } })
    expect((await c.get(`/api/forms/${created.id}`)).json.form.unpublishedChanges).toBe(true)
    expect((((await (await app.request('/api/public/forms/apply')).json()) as any).schema.title)).toBe('Admission')

    await c.post(`/api/forms/${created.id}/unpublish`)
    expect((await app.request('/api/public/forms/apply')).status).toBe(404)
    expect((await c.del(`/api/forms/${created.id}`)).status).toBe(200)
    expect((await c.get(`/api/forms/${created.id}`)).status).toBe(404)
  })

  it('rejects bad names, addresses and schemas', async () => {
    const c = await signedIn()
    const a = (await c.post('/api/forms', { name: 'A' })).json.form
    const b = (await c.post('/api/forms', { name: 'B' })).json.form
    expect((await c.patch(`/api/forms/${a.id}`, { name: '  ' })).status).toBe(422)
    expect((await c.patch(`/api/forms/${a.id}`, { slug: 'Not OK!' })).status).toBe(422)
    expect((await c.patch(`/api/forms/${a.id}`, { slug: b.slug })).status).toBe(409)
    expect((await c.patch(`/api/forms/${a.id}`, { schema: { pages: 'no' } })).status).toBe(422)
    expect((await c.post('/api/forms', '{not json')).status).toBe(400)
  })

  it('will not publish a form with errors', async () => {
    const c = await signedIn()
    const broken = form('Broken', [calculated('a', 'b + 1'), calculated('b', 'a + 1')])
    const created = (await c.post('/api/forms', { name: 'Broken', schema: broken })).json.form
    const res = await c.post(`/api/forms/${created.id}/publish`)
    expect(res.status).toBe(422)
    expect(JSON.stringify(res.json.error.fields)).toContain('Circular reference')
  })

  it("keeps one person's forms and submissions invisible to another", async () => {
    const sita = await signedIn('sita@example.com')
    const form1 = await published(sita)
    const sub = await client().post(`/api/public/forms/${form1.slug}/submissions`, { fullName: 'A', country: 'IN', agree: true })
    const arjun = await signedIn('arjun@example.com')
    expect((await arjun.get('/api/forms')).json.forms).toEqual([])
    for (const res of [
      await arjun.get(`/api/forms/${form1.id}`),
      await arjun.patch(`/api/forms/${form1.id}`, { name: 'Mine now' }),
      await arjun.post(`/api/forms/${form1.id}/publish`),
      await arjun.del(`/api/forms/${form1.id}`),
      await arjun.get(`/api/forms/${form1.id}/submissions`),
      await arjun.get(`/api/forms/${form1.id}/submissions.csv`),
      await arjun.get(`/api/submissions/${sub.json.id}`),
      await arjun.del(`/api/submissions/${sub.json.id}`),
    ]) {
      expect(res.status).toBe(404)
    }
    expect((await sita.get(`/api/forms/${form1.id}`)).json.form.name).toBe('Admission form')
    expect((await sita.get(`/api/submissions/${sub.json.id}`)).status).toBe(200)
  })
})

describe('public form and submissions', () => {
  it('validates on the server, recalculates and stores clean data', async () => {
    const owner = await signedIn()
    const f = await published(owner)
    const visitor = client('10.0.0.2')

    const bad = await visitor.post(`/api/public/forms/${f.slug}/submissions`, { country: 'NP', fee: 'abc' })
    expect(bad.status).toBe(422)
    expect(bad.json.error.fields).toMatchObject({ fullName: ['Full name is required'], district: ['District is required'], fee: ['Fee must be a number'] })

    const good = await visitor.post(`/api/public/forms/${f.slug}/submissions`, {
      fullName: 'Sita Sharma', country: 'IN', district: 'should be dropped', fee: '1000', withVat: 1, agree: true, isAdmin: true,
    })
    expect(good.status).toBe(201)
    expect(good.json.message).toBe('Thank you. Your response has been recorded.')

    const list = (await owner.get(`/api/forms/${f.id}/submissions`)).json
    expect(list.total).toBe(1)
    expect(list.submissions[0].data).toEqual({ fullName: 'Sita Sharma', country: 'IN', fee: 1000, withVat: 1130, agree: true })
    expect(list.columns.map((c: any) => c.key)).toEqual(['fullName', 'country', 'district', 'fee', 'withVat', 'agree'])
    expect((await owner.get('/api/forms')).json.forms[0].submissions).toBe(1)

    const detail = await owner.get(`/api/submissions/${good.json.id}`)
    expect(detail.json).toMatchObject({ form: { name: 'Admission form' }, submission: { id: good.json.id } })
    expect((await owner.del(`/api/submissions/${good.json.id}`)).status).toBe(200)
    expect((await owner.get(`/api/forms/${f.id}/submissions`)).json.total).toBe(0)
  })

  it('works without a session and from any website', async () => {
    const f = await published(await signedIn())
    const res = await app.request(`/api/public/forms/${f.slug}/submissions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'https://school.example' },
      body: JSON.stringify({ fullName: 'A', country: 'IN', agree: true }),
    })
    expect(res.status).toBe(201)
    expect(res.headers.get('access-control-allow-origin')).toBe('*')
  })

  it('stops accepting responses when closed or full', async () => {
    const owner = await signedIn()
    const f = await published(owner)
    const answer = { fullName: 'A', country: 'IN', agree: true }
    await owner.patch(`/api/forms/${f.id}`, { settings: { maxSubmissions: 1 } })
    expect((await client().post(`/api/public/forms/${f.slug}/submissions`, answer)).status).toBe(201)
    const full = await client().post(`/api/public/forms/${f.slug}/submissions`, answer)
    expect(full.status).toBe(403)
    expect(full.json.error.code).toBe('closed')
    expect((((await (await app.request(`/api/public/forms/${f.slug}`)).json()) as any).closed)).toBe(true)
    await owner.patch(`/api/forms/${f.id}`, { settings: { closed: true } })
    expect((await client().post(`/api/public/forms/${f.slug}/submissions`, answer)).status).toBe(403)
  })

  it('limits how fast one visitor can submit, and rejects oversized bodies', async () => {
    const f = await published(await signedIn())
    const visitor = client('10.0.0.50')
    let last = 0
    for (let i = 0; i < 31; i++) last = (await visitor.post(`/api/public/forms/${f.slug}/submissions`, { fullName: 'A', country: 'IN', agree: true })).status
    expect(last).toBe(429)
    const huge = await client('10.0.0.51').post(`/api/public/forms/${f.slug}/submissions`, { fullName: 'x'.repeat(1100000), country: 'IN', agree: true })
    expect(huge.status).toBe(413)
  })

  it('searches, pages and exports submissions', async () => {
    const owner = await signedIn()
    const f = await published(owner)
    const names = ['Sita Sharma', 'Arjun Thapa', '=HYPERLINK("http://evil")', 'Maya, "the best"', '100%_done']
    for (const [i, fullName] of names.entries()) {
      await client(`10.1.0.${i}`).post(`/api/public/forms/${f.slug}/submissions`, { fullName, country: 'IN', fee: i, agree: true })
    }
    expect((await owner.get(`/api/forms/${f.id}/submissions?limit=2`)).json).toMatchObject({ total: 5, submissions: { length: 2 } })
    expect((await owner.get(`/api/forms/${f.id}/submissions?limit=2&offset=4`)).json.submissions).toHaveLength(1)
    expect((await owner.get(`/api/forms/${f.id}/submissions?q=thapa`)).json.submissions.map((s: any) => s.data.fullName)).toEqual(['Arjun Thapa'])
    // % and _ in the search text are matched literally, not as wildcards.
    expect((await owner.get(`/api/forms/${f.id}/submissions?q=${encodeURIComponent('%')}`)).json.total).toBe(1)
    expect((await owner.get(`/api/forms/${f.id}/submissions?q=${encodeURIComponent('_')}`)).json.total).toBe(1)

    const csv = await owner.get(`/api/forms/${f.id}/submissions.csv`)
    expect(csv.headers.get('content-type')).toMatch(/text\/csv/)
    expect(csv.headers.get('content-disposition')).toBe(`attachment; filename="${f.slug}-submissions.csv"`)
    const lines = csv.text.trim().split('\r\n')
    expect(lines[0]).toBe('Submitted,ID,Full name,Country,District,Fee,With VAT,Agree,Status')
    expect(lines).toHaveLength(6)
    // A cell that looks like a formula is neutralised, and quotes and commas are escaped.
    expect(csv.text).toContain(`"'=HYPERLINK(""http://evil"")"`)
    expect(csv.text).toContain('"Maya, ""the best"""')
  })
})

describe('lookups across forms', () => {
  const students = form('Students', [text('rollNo').label('Roll no').required(), text('fullName').label('Name'), text('phone').label('Phone'), number('paid').label('Paid')])
  const invoice = form('Invoice', [
    text('rollNumber').label('Roll number').required(),
    lookup('studentName', { source: 'students', matchField: 'rollNo', matchValue: 'rollNumber', returnField: 'fullName' }).label('Student').required(),
    lookup('paid', { source: 'students', matchField: 'rollNo', matchValue: 'rollNumber', returnField: 'paid', aggregate: 'sum' }).label('Paid'),
    number('due').label('Due'),
    calculated('balance', 'due - paid').label('Balance'),
  ])

  async function setup() {
    const owner = await signedIn()
    const source = await published(owner, students, 'Students')
    expect(source.slug).toBe('students')
    for (const row of [
      { rollNo: '1', fullName: 'Sita Sharma', phone: '9800000001', paid: 9000 },
      { rollNo: '1', fullName: 'Sita Sharma', phone: '9800000001', paid: 3000 },
      { rollNo: '2', fullName: 'Arjun Thapa', phone: '9800000002', paid: 500 },
    ]) {
      expect((await client(`10.2.0.${row.paid}`).post('/api/public/forms/students/submissions', row)).status).toBe(201)
    }
    const target = await published(owner, invoice, 'Invoice')
    return { owner, source, target }
  }
  const ask = (slug: string, query: unknown) => client('10.3.0.1').post(`/api/public/forms/${slug}/lookup`, query)
  const nameQuery = { source: 'students', where: { rollNo: '1' }, select: 'fullName', aggregate: 'first' }

  it('reveals nothing until the source form exposes the fields', async () => {
    const { owner, source, target } = await setup()
    expect((await ask(target.slug, nameQuery)).json).toEqual({ value: null })
    await owner.patch(`/api/forms/${source.id}`, { settings: { exposedFields: ['rollNo', 'fullName', 'paid'] } })
    expect((await ask(target.slug, nameQuery)).json).toEqual({ value: 'Sita Sharma' })
    expect((await ask(target.slug, { source: 'students', where: { rollNo: '1' }, select: 'paid', aggregate: 'sum' })).json).toEqual({ value: 12000 })
    expect((await ask(target.slug, { ...nameQuery, where: { rollNo: '99' } })).json).toEqual({ value: null })
  })

  it('only answers the lookups the form itself defines', async () => {
    const { owner, source, target } = await setup()
    await owner.patch(`/api/forms/${source.id}`, { settings: { exposedFields: ['rollNo', 'fullName', 'paid', 'phone'] } })
    for (const query of [
      { ...nameQuery, select: 'phone' }, // a field the form does not ask for, even though it is exposed
      { ...nameQuery, aggregate: 'list' },
      { ...nameQuery, where: { fullName: 'Sita Sharma' } },
      { ...nameQuery, source: 'invoice' },
      { ...nameQuery, where: {} },
      { source: 'students' },
    ]) {
      expect((await ask(target.slug, query)).status).toBe(403)
    }
  })

  it("cannot read another owner's forms", async () => {
    const { owner, source } = await setup()
    await owner.patch(`/api/forms/${source.id}`, { settings: { exposedFields: ['rollNo', 'fullName', 'paid'] } })
    const other = await signedIn('other@example.com')
    const theirs = await published(other, invoice, 'Their invoice')
    expect((await ask(theirs.slug, nameQuery)).json).toEqual({ value: null })
  })

  it('fetches lookups again when a submission arrives, ignoring forged values', async () => {
    const { owner, source, target } = await setup()
    await owner.patch(`/api/forms/${source.id}`, { settings: { exposedFields: ['rollNo', 'fullName', 'paid'] } })
    const res = await client('10.4.0.1').post(`/api/public/forms/${target.slug}/submissions`, { rollNumber: '1', studentName: 'Forged Name', paid: 999999, due: 20000, balance: -1 })
    expect(res.status).toBe(201)
    const stored = (await owner.get(`/api/forms/${target.id}/submissions`)).json.submissions[0].data
    expect(stored).toEqual({ rollNumber: '1', studentName: 'Sita Sharma', paid: 12000, due: 20000, balance: 8000 })

    const unknown = await client('10.4.0.2').post(`/api/public/forms/${target.slug}/submissions`, { rollNumber: '404', studentName: 'Forged Name' })
    expect(unknown.status).toBe(422)
    expect(unknown.json.error.fields).toEqual({ studentName: ['Student is required'] })
  })
})

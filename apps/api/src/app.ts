import { checkSchema, validateAsync, type FormSchema, type LookupQuery } from '@formknit/core'
import { and, asc, count, desc, eq, gt, inArray, sql } from 'drizzle-orm'
import { Hono, type Context } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { cors } from 'hono/cors'
import {
  createSession, deleteSession, findSessionUser, hashPassword, newId, rateLimiter, SESSION_COOKIE, SESSION_DAYS, verifyPassword,
} from './auth'
import { columnsOf, toCsv } from './csv'
import {
  apiKeys, deliveries, files, forms, notes, passwordResets, sessions, STATUSES, submissions, users, versions, webhooks, type Db,
  type FormSettings, type Status,
} from './db'
import { makeLookup, schemaAllows } from './lookup'
import {
  buildReport, createMailer, dailySeries, deliver, findField, memoryStorage, randomToken, sha256, webhookUrlProblem, type Mail,
  type Storage,
} from './services'
import { TEMPLATES } from './templates'

export interface AppOptions {
  db: Db
  /** Origins the admin app is served from. Changes from any other origin are refused. The first is used in emailed links. */
  webOrigins?: string[]
  /** Send cookies only over HTTPS. Turn on in production. */
  secureCookies?: boolean
  /** Sends email. Defaults to recording it in the outbox table without sending. */
  mailer?: (mail: Mail) => Promise<void>
  /** Where uploaded files are kept. */
  storage?: Storage
  /** Used to call webhooks. Replaceable in tests. */
  fetcher?: typeof fetch
  /** Allow webhooks to private addresses and plain http. For local development only. */
  allowPrivateWebhooks?: boolean
}

type User = { id: string; email: string; name: string }
type Env = { Variables: { user: User; viaKey: boolean } }

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const SLUG = /^[a-z0-9][a-z0-9-]{0,59}$/
const MAX_BODY = 1024 * 1024
const MAX_FILE = 10 * 1024 * 1024
const DAY = 86400000

class ApiError extends Error {
  constructor(
    public status: 400 | 401 | 403 | 404 | 409 | 413 | 422 | 429,
    public code: string,
    message: string,
    public fields?: Record<string, string[]>,
  ) {
    super(message)
  }
}

const blankSchema = (title: string): FormSchema => ({ version: 1, title, pages: [{ key: 'page1', components: [] }] })
const slugify = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50) || 'form'
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

async function body(c: Context): Promise<Record<string, unknown>> {
  if (Number(c.req.header('content-length') ?? 0) > MAX_BODY) throw new ApiError(413, 'too_large', 'The request is too large')
  const text = await c.req.text()
  if (text.length > MAX_BODY) throw new ApiError(413, 'too_large', 'The request is too large')
  let parsed: unknown
  try {
    parsed = JSON.parse(text || '{}')
  } catch {
    throw new ApiError(400, 'bad_json', 'The request body is not valid JSON')
  }
  if (!isObject(parsed)) throw new ApiError(400, 'bad_json', 'The request body must be a JSON object')
  return parsed
}

function checkPassword(password: string): string | null {
  if (password.length < 12) return 'Use at least 12 characters'
  if (password.length > 200) return 'Use at most 200 characters'
  return null
}

export function createApp(options: AppOptions) {
  const { db, webOrigins = ['http://localhost:5175'], secureCookies = false, allowPrivateWebhooks = false } = options
  const mail = options.mailer ?? createMailer(db)
  const storage = options.storage ?? memoryStorage()
  const fetcher = options.fetcher ?? fetch
  const app = new Hono<Env>()
  const loginLimit = rateLimiter(10, 15 * 60000)
  const resetLimit = rateLimiter(5, 15 * 60000)
  const submitLimit = rateLimiter(30, 60000)
  const uploadLimit = rateLimiter(20, 60000)
  const lookupLimit = rateLimiter(120, 60000)
  const clientOf = (c: Context) => c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || 'local'

  // Email and webhooks go out after the response. Tests wait for them with `app.idle()`.
  const pending = new Set<Promise<unknown>>()
  const background = (work: Promise<unknown>) => {
    const tracked = work.catch((e) => console.error(e)).finally(() => pending.delete(tracked))
    pending.add(tracked)
  }

  app.onError((err, c) => {
    if (err instanceof ApiError) return c.json({ error: { code: err.code, message: err.message, fields: err.fields } }, err.status)
    console.error(err)
    return c.json({ error: { code: 'server_error', message: 'Something went wrong on the server' } }, 500)
  })
  app.notFound((c) => c.json({ error: { code: 'not_found', message: 'Not found' } }, 404))

  // Public endpoints may be called from any site (embedded forms). They never use the session cookie.
  app.use('/api/public/*', cors({ origin: '*', allowMethods: ['GET', 'POST'], allowHeaders: ['content-type'] }))

  // Everything else changes data on behalf of a signed-in user, so only accept it from our own app.
  app.use('/api/*', async (c, next) => {
    if (c.req.path.startsWith('/api/public/')) return next()
    const origin = c.req.header('origin')
    const safe = c.req.method === 'GET' || c.req.method === 'HEAD'
    if (!safe && origin && !webOrigins.includes(origin)) throw new ApiError(403, 'bad_origin', 'This request came from a site that is not allowed')
    return next()
  })

  const startSession = (c: Context, userId: string) =>
    setCookie(c, SESSION_COOKIE, createSession(db, userId), {
      httpOnly: true,
      sameSite: 'Lax',
      secure: secureCookies,
      path: '/',
      maxAge: SESSION_DAYS * 86400,
    })

  // ---------- Accounts ----------
  app.post('/api/auth/register', async (c) => {
    const input = await body(c)
    const name = str(input.name)
    const email = str(input.email).toLowerCase()
    const password = typeof input.password === 'string' ? input.password : ''
    const fields: Record<string, string[]> = {}
    if (!name) fields.name = ['Enter your name']
    if (!EMAIL.test(email)) fields.email = ['Enter a valid email address']
    const weak = checkPassword(password)
    if (weak) fields.password = [weak]
    if (Object.keys(fields).length) throw new ApiError(422, 'invalid', 'Please check the details', fields)
    if (db.select({ id: users.id }).from(users).where(eq(users.email, email)).get()) {
      throw new ApiError(409, 'email_taken', 'An account with this email already exists', { email: ['An account with this email already exists'] })
    }
    const user = { id: newId(), email, name }
    db.insert(users).values({ ...user, passwordHash: await hashPassword(password), createdAt: Date.now() }).run()
    startSession(c, user.id)
    return c.json({ user }, 201)
  })

  app.post('/api/auth/login', async (c) => {
    const input = await body(c)
    const email = str(input.email).toLowerCase()
    const password = typeof input.password === 'string' ? input.password : ''
    if (!loginLimit(`${email}|${clientOf(c)}`)) throw new ApiError(429, 'too_many', 'Too many attempts. Try again in a few minutes')
    const row = db.select().from(users).where(eq(users.email, email)).get()
    // Hash even when the account does not exist, so the response time does not reveal which emails are registered.
    const ok = await verifyPassword(password, row?.passwordHash ?? 'scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAA')
    if (!row || !ok) throw new ApiError(401, 'bad_login', 'The email or password is not correct')
    startSession(c, row.id)
    return c.json({ user: { id: row.id, email: row.email, name: row.name } })
  })

  app.post('/api/auth/logout', (c) => {
    deleteSession(db, getCookie(c, SESSION_COOKIE))
    deleteCookie(c, SESSION_COOKIE, { path: '/' })
    return c.json({ ok: true })
  })

  app.get('/api/auth/me', (c) => c.json({ user: findSessionUser(db, getCookie(c, SESSION_COOKIE)) ?? null }))

  // The answer is the same whether or not the account exists, so this cannot be used to find out who has one.
  app.post('/api/auth/forgot', async (c) => {
    const email = str((await body(c)).email).toLowerCase()
    if (!resetLimit(`${email}|${clientOf(c)}`)) throw new ApiError(429, 'too_many', 'Too many attempts. Try again in a few minutes')
    const user = db.select().from(users).where(eq(users.email, email)).get()
    if (user) {
      const token = randomToken()
      db.insert(passwordResets).values({ id: sha256(token), userId: user.id, expiresAt: Date.now() + 3600000 }).run()
      background(
        mail({
          to: user.email,
          subject: 'Reset your Formknit password',
          text: `Hello ${user.name},\n\nUse this link to choose a new password. It works once and expires in one hour.\n\n${webOrigins[0]}/reset?token=${token}\n\nIf you did not ask for this, you can ignore this email.`,
        }),
      )
    }
    return c.json({ ok: true })
  })

  app.post('/api/auth/reset', async (c) => {
    const input = await body(c)
    const password = typeof input.password === 'string' ? input.password : ''
    const weak = checkPassword(password)
    if (weak) throw new ApiError(422, 'invalid', 'Please check the details', { password: [weak] })
    const id = sha256(str(input.token))
    const reset = db.select().from(passwordResets).where(and(eq(passwordResets.id, id), gt(passwordResets.expiresAt, Date.now()))).get()
    if (!reset || reset.usedAt) throw new ApiError(400, 'bad_token', 'This reset link is not valid any more. Ask for a new one')
    db.update(passwordResets).set({ usedAt: Date.now() }).where(eq(passwordResets.id, id)).run()
    db.update(users).set({ passwordHash: await hashPassword(password) }).where(eq(users.id, reset.userId)).run()
    // Whoever knew the old password is signed out everywhere.
    db.delete(sessions).where(eq(sessions.userId, reset.userId)).run()
    return c.json({ ok: true })
  })

  // ---------- Public: what respondents use ----------
  const publicForm = (slug: string) => {
    const form = db.select().from(forms).where(and(eq(forms.slug, slug), eq(forms.status, 'published'))).get()
    if (!form?.publishedSchema) throw new ApiError(404, 'not_found', 'This form does not exist or is not published')
    return { ...form, publishedSchema: form.publishedSchema }
  }
  const submissionCount = (formId: string) => db.select({ n: count() }).from(submissions).where(eq(submissions.formId, formId)).get()?.n ?? 0

  /** Why a form is not taking responses right now, or null if it is. */
  const closedReason = (form: { id: string; settings: FormSettings }, now = Date.now()): 'closed' | 'not_open' | 'ended' | 'full' | null => {
    const s = form.settings
    if (s.closed) return 'closed'
    if (s.opensAt && now < Date.parse(s.opensAt)) return 'not_open'
    if (s.closesAt && now >= Date.parse(s.closesAt)) return 'ended'
    if (s.maxSubmissions && submissionCount(form.id) >= s.maxSubmissions) return 'full'
    return null
  }

  app.get('/api/public/forms/:slug', (c) => {
    const form = publicForm(c.req.param('slug'))
    const reason = closedReason(form)
    return c.json({ name: form.name, slug: form.slug, schema: form.publishedSchema, closed: reason !== null, reason, opensAt: form.settings.opensAt ?? null })
  })

  app.post('/api/public/forms/:slug/lookup', async (c) => {
    const form = publicForm(c.req.param('slug'))
    if (!lookupLimit(`${form.id}|${clientOf(c)}`)) throw new ApiError(429, 'too_many', 'Too many requests. Try again shortly')
    const query = (await body(c)) as unknown as LookupQuery
    if (!isObject(query.where) || typeof query.source !== 'string' || !schemaAllows(form.publishedSchema, query)) {
      throw new ApiError(403, 'not_allowed', 'This form does not define that lookup')
    }
    return c.json({ value: (await makeLookup(db, form.ownerId)(query)) ?? null })
  })

  // Uploads are accepted only for a file field the form really has, within that field's own limits.
  app.post('/api/public/forms/:slug/files', async (c) => {
    const form = publicForm(c.req.param('slug'))
    if (!uploadLimit(`${form.id}|${clientOf(c)}`)) throw new ApiError(429, 'too_many', 'Too many uploads. Try again in a minute')
    if (closedReason(form)) throw new ApiError(403, 'closed', 'This form is not accepting responses')
    if (Number(c.req.header('content-length') ?? 0) > MAX_FILE + 4096) throw new ApiError(413, 'too_large', 'The file is too large')
    const field = findField(form.publishedSchema, c.req.query('field') ?? '')
    if (field?.type !== 'file') throw new ApiError(400, 'no_field', 'This form has no such file field')
    const upload = (await c.req.parseBody()).file
    if (!(upload instanceof File)) throw new ApiError(400, 'no_file', 'No file was sent')
    const limit = Math.min(MAX_FILE, (field.validate?.maxSizeMb ?? 10) * 1024 * 1024)
    if (upload.size > limit) throw new ApiError(413, 'too_large', `The file must be ${Math.round(limit / 1048576)} MB or smaller`)
    if (field.accept) {
      const name = upload.name.toLowerCase()
      const type = upload.type.toLowerCase()
      const accepted = field.accept.split(',').map((a) => a.trim().toLowerCase()).filter(Boolean)
      if (!accepted.some((a) => (a.startsWith('.') ? name.endsWith(a) : a.endsWith('/*') ? type.startsWith(a.slice(0, -1)) : type === a))) {
        throw new ApiError(422, 'bad_type', `The file must be one of: ${field.accept}`)
      }
    }
    const id = newId()
    await storage.save(id, new Uint8Array(await upload.arrayBuffer()))
    const name = upload.name.replace(/[\\/\0-\x1f]/g, '_').slice(0, 200) || 'file'
    db.insert(files).values({ id, formId: form.id, name, size: upload.size, type: upload.type.slice(0, 100) || 'application/octet-stream', createdAt: Date.now() }).run()
    return c.json({ id, name, size: upload.size, type: upload.type, url: `/api/files/${id}` }, 201)
  })

  /** Tells the form's owner and any webhooks about something that happened to a submission. */
  const announce = (form: typeof forms.$inferSelect, event: string, submission: { id: string; status: Status; createdAt: number; data: Record<string, unknown> }) => {
    const hooks = db.select().from(webhooks).where(and(eq(webhooks.formId, form.id), eq(webhooks.active, true))).all()
    for (const hook of hooks) background(deliver(db, fetcher, hook, event, { form: { id: form.id, name: form.name, slug: form.slug }, submission }))
    if (event !== 'submission.created') return
    const lines = columnsOf(form.publishedSchema ?? form.schema).map((col) => {
      const value = submission.data[col.key]
      return `${col.label}: ${value === null || value === undefined ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value)}`
    })
    for (const to of form.settings.notifyEmails ?? []) {
      background(mail({ to, subject: `New submission: ${form.name}`, text: `${lines.join('\n')}\n\nOpen it: ${webOrigins[0]}/submissions/${submission.id}` }))
    }
  }

  app.post('/api/public/forms/:slug/submissions', async (c) => {
    const form = publicForm(c.req.param('slug'))
    if (!submitLimit(`${form.id}|${clientOf(c)}`)) throw new ApiError(429, 'too_many', 'Too many submissions. Try again in a minute')
    if (closedReason(form)) throw new ApiError(403, 'closed', 'This form is not accepting responses')
    // Lookups are fetched again here and formulas recalculated, so nothing the browser sent is trusted.
    const result = await validateAsync(form.publishedSchema, await body(c), { lookup: makeLookup(db, form.ownerId) })
    if (!result.valid) throw new ApiError(422, 'invalid', 'Some answers need attention', result.errors)
    const row = { id: newId(), formId: form.id, data: result.data, status: 'new' as const, createdAt: Date.now() }
    db.insert(submissions).values(row).run()
    announce(form, 'submission.created', row)
    return c.json({ id: row.id, message: form.settings.successMessage || 'Thank you. Your response has been recorded.' }, 201)
  })

  // ---------- Signed-in only from here ----------
  const signedIn = new Hono<Env>()
  signedIn.use('*', async (c, next) => {
    let user = findSessionUser(db, getCookie(c, SESSION_COOKIE))
    let viaKey = false
    const bearer = c.req.header('authorization')?.match(/^Bearer (fk_[A-Za-z0-9_-]+)$/)?.[1]
    if (!user && bearer) {
      // API keys can read but not change anything.
      if (c.req.method !== 'GET') throw new ApiError(403, 'read_only', 'API keys can only read data')
      const key = db.select().from(apiKeys).where(eq(apiKeys.id, sha256(bearer))).get()
      if (key) {
        user = db.select({ id: users.id, email: users.email, name: users.name }).from(users).where(eq(users.id, key.userId)).get()
        db.update(apiKeys).set({ lastUsedAt: Date.now() }).where(eq(apiKeys.id, key.id)).run()
        viaKey = true
      }
    }
    if (!user) throw new ApiError(401, 'signed_out', 'Sign in to continue')
    c.set('user', user)
    c.set('viaKey', viaKey)
    return next()
  })
  /** Account management needs a real sign-in, not an API key. */
  const sessionOnly = (c: Context<Env>) => {
    if (c.get('viaKey')) throw new ApiError(403, 'session_required', 'This needs a signed-in session, not an API key')
  }

  signedIn.patch('/auth/profile', async (c) => {
    sessionOnly(c)
    const name = str((await body(c)).name)
    if (!name) throw new ApiError(422, 'invalid', 'Please check the details', { name: ['Enter your name'] })
    db.update(users).set({ name: name.slice(0, 120) }).where(eq(users.id, c.get('user').id)).run()
    return c.json({ user: { ...c.get('user'), name: name.slice(0, 120) } })
  })

  signedIn.post('/auth/password', async (c) => {
    sessionOnly(c)
    const input = await body(c)
    const next = typeof input.newPassword === 'string' ? input.newPassword : ''
    const row = db.select().from(users).where(eq(users.id, c.get('user').id)).get()!
    if (!(await verifyPassword(typeof input.currentPassword === 'string' ? input.currentPassword : '', row.passwordHash))) {
      throw new ApiError(422, 'invalid', 'Please check the details', { currentPassword: ['That is not your current password'] })
    }
    const weak = checkPassword(next)
    if (weak) throw new ApiError(422, 'invalid', 'Please check the details', { newPassword: [weak] })
    db.update(users).set({ passwordHash: await hashPassword(next) }).where(eq(users.id, row.id)).run()
    // Sign out every other device, and give this one a fresh session.
    db.delete(sessions).where(eq(sessions.userId, row.id)).run()
    startSession(c, row.id)
    return c.json({ ok: true })
  })

  signedIn.get('/api-keys', (c) => {
    sessionOnly(c)
    const rows = db.select({ id: apiKeys.id, name: apiKeys.name, prefix: apiKeys.prefix, createdAt: apiKeys.createdAt, lastUsedAt: apiKeys.lastUsedAt }).from(apiKeys).where(eq(apiKeys.userId, c.get('user').id)).orderBy(desc(apiKeys.createdAt)).all()
    return c.json({ keys: rows })
  })
  signedIn.post('/api-keys', async (c) => {
    sessionOnly(c)
    const name = str((await body(c)).name).slice(0, 80) || 'API key'
    const key = `fk_${randomToken(24)}`
    db.insert(apiKeys).values({ id: sha256(key), userId: c.get('user').id, name, prefix: key.slice(0, 10), createdAt: Date.now() }).run()
    // The only time the key is ever shown.
    return c.json({ key, name, prefix: key.slice(0, 10) }, 201)
  })
  signedIn.delete('/api-keys/:id', (c) => {
    sessionOnly(c)
    db.delete(apiKeys).where(and(eq(apiKeys.id, c.req.param('id')), eq(apiKeys.userId, c.get('user').id))).run()
    return c.json({ ok: true })
  })

  /** Loads a form and checks it belongs to the signed-in user. Other people's forms look like they do not exist. */
  const ownForm = (c: Context<Env>, id = c.req.param('id') ?? '') => {
    const form = db.select().from(forms).where(and(eq(forms.id, id), eq(forms.ownerId, c.get('user').id))).get()
    if (!form) throw new ApiError(404, 'not_found', 'Form not found')
    return form
  }
  const uniqueSlug = (base: string, exceptId?: string) => {
    for (let n = 1; ; n++) {
      const slug = n === 1 ? base : `${base}-${n}`
      const taken = db.select({ id: forms.id }).from(forms).where(eq(forms.slug, slug)).get()
      if (!taken || taken.id === exceptId) return slug
    }
  }
  const summary = (form: typeof forms.$inferSelect) => ({
    id: form.id,
    name: form.name,
    slug: form.slug,
    status: form.status,
    publishedAt: form.publishedAt,
    updatedAt: form.updatedAt,
    submissions: submissionCount(form.id),
    // True when the builder has changes that respondents cannot see yet.
    unpublishedChanges: form.status === 'published' && JSON.stringify(form.schema) !== JSON.stringify(form.publishedSchema),
    closedReason: form.status === 'published' ? closedReason(form) : null,
  })
  const detail = (form: typeof forms.$inferSelect) => ({ ...summary(form), schema: form.schema, settings: form.settings, issues: checkSchema(form.schema) })

  signedIn.get('/dashboard', (c) => {
    const mine = db.select().from(forms).where(eq(forms.ownerId, c.get('user').id)).all()
    const ids = mine.map((f) => f.id)
    const rows = ids.length ? db.select().from(submissions).where(inArray(submissions.formId, ids)).orderBy(desc(submissions.createdAt)).all() : []
    const now = Date.now()
    const names = new Map(mine.map((f) => [f.id, f.name]))
    return c.json({
      forms: mine.length,
      published: mine.filter((f) => f.status === 'published').length,
      submissions: rows.length,
      thisWeek: rows.filter((r) => r.createdAt > now - 7 * DAY).length,
      awaitingReview: rows.filter((r) => r.status === 'new' || r.status === 'in_review').length,
      series: dailySeries(rows.map((r) => r.createdAt), 14, now),
      recent: rows.slice(0, 6).map((r) => ({ id: r.id, formId: r.formId, formName: names.get(r.formId), status: r.status, createdAt: r.createdAt })),
      topForms: mine.map((f) => ({ id: f.id, name: f.name, submissions: rows.filter((r) => r.formId === f.id).length })).sort((a, b) => b.submissions - a.submissions).slice(0, 5),
    })
  })

  signedIn.get('/templates', (c) => c.json({ templates: TEMPLATES.map(({ id, name, description, schema }) => ({ id, name, description, fields: columnsOf(schema).length })) }))

  signedIn.get('/forms', (c) => {
    const rows = db.select().from(forms).where(eq(forms.ownerId, c.get('user').id)).orderBy(desc(forms.updatedAt)).all()
    return c.json({ forms: rows.map(summary) })
  })

  const insertForm = (ownerId: string, name: string, schema: FormSchema, settings: FormSettings = {}) => {
    const now = Date.now()
    const form = {
      id: newId(), ownerId, name, slug: uniqueSlug(slugify(name)), status: 'draft' as const, schema,
      publishedSchema: null, publishedAt: null, settings, createdAt: now, updatedAt: now,
    }
    db.insert(forms).values(form).run()
    return form
  }

  signedIn.post('/forms', async (c) => {
    const input = await body(c)
    const template = input.template ? TEMPLATES.find((t) => t.id === input.template) : undefined
    if (input.template && !template) throw new ApiError(422, 'invalid', 'That template does not exist')
    const name = (str(input.name) || template?.name || 'Untitled form').slice(0, 120)
    const given = isObject(input.schema) && Array.isArray(input.schema.pages) ? (input.schema as unknown as FormSchema) : undefined
    const schema = given ?? (template ? { ...template.schema, title: name } : blankSchema(name))
    return c.json({ form: detail(insertForm(c.get('user').id, name, schema)) }, 201)
  })

  signedIn.post('/forms/:id/duplicate', (c) => {
    const source = ownForm(c)
    // The copy starts as an unpublished draft with the same design and settings, and no submissions.
    const { exposedFields: _unused, ...settings } = source.settings
    return c.json({ form: detail(insertForm(c.get('user').id, `${source.name} (copy)`.slice(0, 120), source.schema, settings)) }, 201)
  })

  signedIn.get('/forms/:id', (c) => c.json({ form: detail(ownForm(c)) }))

  signedIn.patch('/forms/:id', async (c) => {
    const form = ownForm(c)
    const input = await body(c)
    const patch: Partial<typeof forms.$inferInsert> = { updatedAt: Date.now() }
    const fail = (field: string, message: string): never => {
      throw new ApiError(422, 'invalid', 'Please check the details', { [field]: [message] })
    }
    if (input.name !== undefined) {
      if (!str(input.name)) fail('name', 'Enter a name')
      patch.name = str(input.name).slice(0, 120)
    }
    if (input.slug !== undefined) {
      const slug = str(input.slug).toLowerCase()
      if (!SLUG.test(slug)) fail('slug', 'Use up to 60 lowercase letters, digits and hyphens, starting with a letter or digit')
      if (uniqueSlug(slug, form.id) !== slug) throw new ApiError(409, 'slug_taken', 'That address is already used by another form', { slug: ['That address is already used by another form'] })
      patch.slug = slug
    }
    if (input.schema !== undefined) {
      if (!isObject(input.schema) || !Array.isArray(input.schema.pages)) throw new ApiError(422, 'invalid', 'The schema needs a list of pages')
      patch.schema = input.schema as unknown as FormSchema
    }
    if (input.settings !== undefined) {
      if (!isObject(input.settings)) throw new ApiError(422, 'invalid', 'Settings must be an object')
      const s = input.settings
      // Only the settings that were sent are changed; the rest keep their values.
      const next: FormSettings = { ...form.settings }
      if ('successMessage' in s) next.successMessage = str(s.successMessage).slice(0, 500) || undefined
      if ('closed' in s) next.closed = s.closed === true || undefined
      if ('maxSubmissions' in s) {
        const max = Number(s.maxSubmissions)
        next.maxSubmissions = Number.isInteger(max) && max > 0 ? max : undefined
      }
      if ('exposedFields' in s) next.exposedFields = Array.isArray(s.exposedFields) ? s.exposedFields.filter((k): k is string => typeof k === 'string').slice(0, 200) : undefined
      for (const key of ['opensAt', 'closesAt'] as const) {
        if (!(key in s)) continue
        const value = str(s[key])
        if (value && Number.isNaN(Date.parse(value))) fail(key, 'Enter a valid date and time')
        next[key] = value ? new Date(value).toISOString() : undefined
      }
      if (next.opensAt && next.closesAt && next.closesAt <= next.opensAt) fail('closesAt', 'The closing time must be after the opening time')
      if ('notifyEmails' in s) {
        const list = (Array.isArray(s.notifyEmails) ? s.notifyEmails : str(s.notifyEmails).split(/[\s,;]+/)).map((e) => str(e).toLowerCase()).filter(Boolean)
        const bad = list.find((e) => !EMAIL.test(e))
        if (bad) fail('notifyEmails', `"${bad}" is not a valid email address`)
        next.notifyEmails = list.length ? [...new Set(list)].slice(0, 20) : undefined
      }
      patch.settings = next
    }
    db.update(forms).set(patch).where(eq(forms.id, form.id)).run()
    return c.json({ form: detail(ownForm(c)) })
  })

  signedIn.post('/forms/:id/publish', (c) => {
    const form = ownForm(c)
    const errors = checkSchema(form.schema).filter((i) => i.level === 'error')
    if (errors.length) {
      throw new ApiError(422, 'schema_errors', 'Fix the problems in the form before publishing', Object.fromEntries(errors.map((e, i) => [`${i}:${e.path}`, [e.message]])))
    }
    const now = Date.now()
    // Publishing the same design twice does not create a new version.
    if (JSON.stringify(form.schema) !== JSON.stringify(form.publishedSchema) || form.status !== 'published') {
      const last = db.select({ v: versions.version, schema: versions.schema }).from(versions).where(eq(versions.formId, form.id)).orderBy(desc(versions.version)).limit(1).get()
      if (!last || JSON.stringify(last.schema) !== JSON.stringify(form.schema)) {
        db.insert(versions).values({ id: newId(), formId: form.id, version: (last?.v ?? 0) + 1, schema: form.schema, publishedAt: now }).run()
      }
    }
    db.update(forms).set({ status: 'published', publishedSchema: form.schema, publishedAt: now, updatedAt: now }).where(eq(forms.id, form.id)).run()
    return c.json({ form: summary(ownForm(c)) })
  })

  signedIn.post('/forms/:id/unpublish', (c) => {
    const form = ownForm(c)
    db.update(forms).set({ status: 'draft', updatedAt: Date.now() }).where(eq(forms.id, form.id)).run()
    return c.json({ form: summary(ownForm(c)) })
  })

  signedIn.delete('/forms/:id', async (c) => {
    const form = ownForm(c)
    for (const file of db.select({ id: files.id }).from(files).where(eq(files.formId, form.id)).all()) await storage.remove(file.id)
    db.delete(forms).where(eq(forms.id, form.id)).run()
    return c.json({ ok: true })
  })

  signedIn.get('/forms/:id/versions', (c) => {
    const form = ownForm(c)
    const rows = db.select().from(versions).where(eq(versions.formId, form.id)).orderBy(desc(versions.version)).all()
    const live = JSON.stringify(form.publishedSchema)
    return c.json({
      versions: rows.map((v) => ({
        id: v.id,
        version: v.version,
        publishedAt: v.publishedAt,
        fields: columnsOf(v.schema).length,
        pages: v.schema.pages?.length ?? 0,
        live: form.status === 'published' && JSON.stringify(v.schema) === live,
      })),
    })
  })

  // Restoring copies an old version into the draft. Nothing changes for respondents until it is published.
  signedIn.post('/forms/:id/versions/:versionId/restore', (c) => {
    const form = ownForm(c)
    const version = db.select().from(versions).where(and(eq(versions.id, c.req.param('versionId')), eq(versions.formId, form.id))).get()
    if (!version) throw new ApiError(404, 'not_found', 'Version not found')
    db.update(forms).set({ schema: version.schema, updatedAt: Date.now() }).where(eq(forms.id, form.id)).run()
    return c.json({ form: detail(ownForm(c)) })
  })

  signedIn.get('/forms/:id/report', (c) => {
    const form = ownForm(c)
    const rows = db.select({ data: submissions.data, status: submissions.status, createdAt: submissions.createdAt }).from(submissions).where(eq(submissions.formId, form.id)).all()
    return c.json({ report: buildReport(form.publishedSchema ?? form.schema, rows) })
  })

  // ---------- Webhooks ----------
  signedIn.get('/forms/:id/webhooks', (c) => {
    const form = ownForm(c)
    const hooks = db.select().from(webhooks).where(eq(webhooks.formId, form.id)).orderBy(asc(webhooks.createdAt)).all()
    return c.json({
      webhooks: hooks.map((h) => ({
        id: h.id,
        url: h.url,
        active: h.active,
        secret: h.secret,
        last: db.select().from(deliveries).where(eq(deliveries.webhookId, h.id)).orderBy(desc(deliveries.createdAt)).limit(1).get() ?? null,
      })),
    })
  })
  signedIn.post('/forms/:id/webhooks', async (c) => {
    const form = ownForm(c)
    const url = str((await body(c)).url)
    const problem = webhookUrlProblem(url, allowPrivateWebhooks)
    if (problem) throw new ApiError(422, 'invalid', 'Please check the details', { url: [problem] })
    if ((db.select({ n: count() }).from(webhooks).where(eq(webhooks.formId, form.id)).get()?.n ?? 0) >= 10) throw new ApiError(422, 'invalid', 'A form can have at most 10 webhooks')
    const hook = { id: newId(), formId: form.id, url, secret: `whsec_${randomToken(24)}`, active: true, createdAt: Date.now() }
    db.insert(webhooks).values(hook).run()
    return c.json({ webhook: { id: hook.id, url: hook.url, active: true, secret: hook.secret, last: null } }, 201)
  })
  const ownHook = (c: Context<Env>) => {
    const hook = db.select().from(webhooks).where(and(eq(webhooks.id, c.req.param('hookId') ?? ''), eq(webhooks.formId, ownForm(c).id))).get()
    if (!hook) throw new ApiError(404, 'not_found', 'Webhook not found')
    return hook
  }
  signedIn.patch('/forms/:id/webhooks/:hookId', async (c) => {
    const hook = ownHook(c)
    db.update(webhooks).set({ active: (await body(c)).active === true }).where(eq(webhooks.id, hook.id)).run()
    return c.json({ ok: true })
  })
  signedIn.delete('/forms/:id/webhooks/:hookId', (c) => {
    db.delete(webhooks).where(eq(webhooks.id, ownHook(c).id)).run()
    return c.json({ ok: true })
  })
  signedIn.post('/forms/:id/webhooks/:hookId/test', async (c) => {
    const hook = ownHook(c)
    const form = ownForm(c)
    const result = await deliver(db, fetcher, hook, 'webhook.test', { form: { id: form.id, name: form.name, slug: form.slug }, submission: null })
    return c.json({ result })
  })

  // ---------- Submissions ----------
  signedIn.get('/forms/:id/submissions', (c) => {
    const form = ownForm(c)
    const limit = Math.min(100, Math.max(1, Number(c.req.query('limit')) || 25))
    const offset = Math.max(0, Number(c.req.query('offset')) || 0)
    const q = (c.req.query('q') ?? '').trim()
    const status = STATUSES.find((s) => s === c.req.query('status'))
    // A plain text search over the stored answers. Wildcards in the search text are matched literally.
    const pattern = `%${q.replace(/[\\%_]/g, '\\$&')}%`
    const where = and(
      eq(submissions.formId, form.id),
      q ? sql`${submissions.data} LIKE ${pattern} ESCAPE '\\'` : undefined,
      status ? eq(submissions.status, status) : undefined,
    )
    const rows = db.select().from(submissions).where(where).orderBy(desc(submissions.createdAt)).limit(limit).offset(offset).all()
    const total = db.select({ n: count() }).from(submissions).where(where).get()?.n ?? 0
    return c.json({ submissions: rows, total, columns: columnsOf(form.publishedSchema ?? form.schema) })
  })

  signedIn.get('/forms/:id/submissions.csv', (c) => {
    const form = ownForm(c)
    const rows = db.select().from(submissions).where(eq(submissions.formId, form.id)).orderBy(desc(submissions.createdAt)).all()
    const columns = [...columnsOf(form.publishedSchema ?? form.schema), { key: '__status', label: 'Status' }]
    c.header('content-type', 'text/csv; charset=utf-8')
    c.header('content-disposition', `attachment; filename="${form.slug}-submissions.csv"`)
    return c.body(toCsv(columns, rows.map((r) => ({ ...r, data: { ...r.data, __status: r.status } }))))
  })

  const ownSubmission = (c: Context<Env>) => {
    const row = db
      .select({ submission: submissions, form: forms })
      .from(submissions)
      .innerJoin(forms, eq(forms.id, submissions.formId))
      .where(and(eq(submissions.id, c.req.param('id') ?? ''), eq(forms.ownerId, c.get('user').id)))
      .get()
    if (!row) throw new ApiError(404, 'not_found', 'Submission not found')
    return row
  }
  const notesOf = (submissionId: string) =>
    db
      .select({ id: notes.id, body: notes.body, createdAt: notes.createdAt, author: users.name })
      .from(notes)
      .innerJoin(users, eq(users.id, notes.userId))
      .where(eq(notes.submissionId, submissionId))
      .orderBy(asc(notes.createdAt))
      .all()

  signedIn.get('/submissions/:id', (c) => {
    const { submission, form } = ownSubmission(c)
    return c.json({
      submission,
      form: { id: form.id, name: form.name },
      schema: form.publishedSchema ?? form.schema,
      columns: columnsOf(form.publishedSchema ?? form.schema),
      notes: notesOf(submission.id),
    })
  })

  signedIn.patch('/submissions/:id', async (c) => {
    const { submission, form } = ownSubmission(c)
    const input = await body(c)
    const patch: Partial<typeof submissions.$inferInsert> = { updatedAt: Date.now() }
    if (input.status !== undefined) {
      const status = STATUSES.find((s) => s === input.status)
      if (!status) throw new ApiError(422, 'invalid', 'That is not a valid status')
      patch.status = status
    }
    if (input.data !== undefined) {
      if (!isObject(input.data)) throw new ApiError(422, 'invalid', 'The answers must be an object')
      // Edited answers go through the same checks as a new submission.
      const result = await validateAsync(form.publishedSchema ?? form.schema, input.data, { lookup: makeLookup(db, form.ownerId) })
      if (!result.valid) throw new ApiError(422, 'invalid', 'Some answers need attention', result.errors)
      patch.data = result.data
    }
    db.update(submissions).set(patch).where(eq(submissions.id, submission.id)).run()
    const updated = ownSubmission(c).submission
    if (patch.status && patch.status !== submission.status) announce(form, 'submission.status_changed', updated)
    return c.json({ submission: updated })
  })

  signedIn.post('/submissions/:id/notes', async (c) => {
    const { submission } = ownSubmission(c)
    const text = str((await body(c)).body)
    if (!text) throw new ApiError(422, 'invalid', 'Please check the details', { body: ['Write a note first'] })
    db.insert(notes).values({ id: newId(), submissionId: submission.id, userId: c.get('user').id, body: text.slice(0, 4000), createdAt: Date.now() }).run()
    return c.json({ notes: notesOf(submission.id) }, 201)
  })

  signedIn.delete('/submissions/:id', (c) => {
    db.delete(submissions).where(eq(submissions.id, ownSubmission(c).submission.id)).run()
    return c.json({ ok: true })
  })

  // Uploaded files are private: only the form's owner can download them.
  signedIn.get('/files/:id', async (c) => {
    const row = db
      .select({ file: files })
      .from(files)
      .innerJoin(forms, eq(forms.id, files.formId))
      .where(and(eq(files.id, c.req.param('id')), eq(forms.ownerId, c.get('user').id)))
      .get()
    const bytes = row ? await storage.read(row.file.id) : null
    if (!row || !bytes) throw new ApiError(404, 'not_found', 'File not found')
    // Always a download, never shown in the page, so an uploaded HTML file cannot run as part of this site.
    c.header('content-type', 'application/octet-stream')
    c.header('content-disposition', `attachment; filename*=UTF-8''${encodeURIComponent(row.file.name)}`)
    c.header('x-content-type-options', 'nosniff')
    return c.body(bytes as Uint8Array<ArrayBuffer>)
  })

  app.route('/api', signedIn)
  return Object.assign(app, { idle: () => Promise.all([...pending]) })
}

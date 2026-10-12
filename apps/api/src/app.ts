import { checkSchema, validateAsync, type FormSchema, type LookupQuery } from '@formknit/core'
import { and, count, desc, eq, sql } from 'drizzle-orm'
import { Hono, type Context } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { cors } from 'hono/cors'
import {
  createSession, deleteSession, findSessionUser, hashPassword, newId, rateLimiter, SESSION_COOKIE, SESSION_DAYS, verifyPassword,
} from './auth'
import { columnsOf, toCsv } from './csv'
import { forms, submissions, users, type Db, type FormSettings } from './db'
import { makeLookup, schemaAllows } from './lookup'

export interface AppOptions {
  db: Db
  /** Origins the admin app is served from. Changes from any other origin are refused. */
  webOrigins?: string[]
  /** Send cookies only over HTTPS. Turn on in production. */
  secureCookies?: boolean
}

type User = { id: string; email: string; name: string }
type Env = { Variables: { user: User } }

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const SLUG = /^[a-z0-9][a-z0-9-]{0,59}$/
const MAX_BODY = 1024 * 1024

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

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

export function createApp({ db, webOrigins = ['http://localhost:5175'], secureCookies = false }: AppOptions) {
  const app = new Hono<Env>()
  const loginLimit = rateLimiter(10, 15 * 60000)
  const submitLimit = rateLimiter(30, 60000)
  const lookupLimit = rateLimiter(120, 60000)
  const clientOf = (c: Context) => c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || 'local'

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
    if (password.length < 12) fields.password = ['Use at least 12 characters']
    if (password.length > 200) fields.password = ['Use at most 200 characters']
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

  // ---------- Public: what respondents use ----------
  const publicForm = (slug: string) => {
    const form = db.select().from(forms).where(and(eq(forms.slug, slug), eq(forms.status, 'published'))).get()
    if (!form?.publishedSchema) throw new ApiError(404, 'not_found', 'This form does not exist or is not published')
    return { ...form, publishedSchema: form.publishedSchema }
  }
  const submissionCount = (formId: string) => db.select({ n: count() }).from(submissions).where(eq(submissions.formId, formId)).get()?.n ?? 0
  const isClosed = (form: { id: string; settings: FormSettings }) =>
    !!form.settings.closed || (!!form.settings.maxSubmissions && submissionCount(form.id) >= form.settings.maxSubmissions)

  app.get('/api/public/forms/:slug', (c) => {
    const form = publicForm(c.req.param('slug'))
    return c.json({ name: form.name, slug: form.slug, schema: form.publishedSchema, closed: isClosed(form) })
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

  app.post('/api/public/forms/:slug/submissions', async (c) => {
    const form = publicForm(c.req.param('slug'))
    if (!submitLimit(`${form.id}|${clientOf(c)}`)) throw new ApiError(429, 'too_many', 'Too many submissions. Try again in a minute')
    if (isClosed(form)) throw new ApiError(403, 'closed', 'This form is no longer accepting responses')
    // Lookups are fetched again here and formulas recalculated, so nothing the browser sent is trusted.
    const result = await validateAsync(form.publishedSchema, await body(c), { lookup: makeLookup(db, form.ownerId) })
    if (!result.valid) throw new ApiError(422, 'invalid', 'Some answers need attention', result.errors)
    const id = newId()
    db.insert(submissions).values({ id, formId: form.id, data: result.data, createdAt: Date.now() }).run()
    return c.json({ id, message: form.settings.successMessage || 'Thank you. Your response has been recorded.' }, 201)
  })

  // ---------- Signed-in only from here ----------
  const signedIn = new Hono<Env>()
  signedIn.use('*', async (c, next) => {
    const user = findSessionUser(db, getCookie(c, SESSION_COOKIE))
    if (!user) throw new ApiError(401, 'signed_out', 'Sign in to continue')
    c.set('user', user)
    return next()
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
  })

  signedIn.get('/forms', (c) => {
    const rows = db.select().from(forms).where(eq(forms.ownerId, c.get('user').id)).orderBy(desc(forms.updatedAt)).all()
    return c.json({ forms: rows.map(summary) })
  })

  signedIn.post('/forms', async (c) => {
    const input = await body(c)
    const name = str(input.name) || 'Untitled form'
    const schema = isObject(input.schema) && Array.isArray(input.schema.pages) ? (input.schema as unknown as FormSchema) : blankSchema(name)
    const now = Date.now()
    const form = {
      id: newId(),
      ownerId: c.get('user').id,
      name,
      slug: uniqueSlug(slugify(name)),
      status: 'draft' as const,
      schema,
      publishedSchema: null,
      publishedAt: null,
      settings: {},
      createdAt: now,
      updatedAt: now,
    }
    db.insert(forms).values(form).run()
    return c.json({ form: { ...summary(form), schema: form.schema, settings: form.settings } }, 201)
  })

  signedIn.get('/forms/:id', (c) => {
    const form = ownForm(c)
    return c.json({ form: { ...summary(form), schema: form.schema, settings: form.settings, issues: checkSchema(form.schema) } })
  })

  signedIn.patch('/forms/:id', async (c) => {
    const form = ownForm(c)
    const input = await body(c)
    const patch: Partial<typeof forms.$inferInsert> = { updatedAt: Date.now() }
    if (input.name !== undefined) {
      if (!str(input.name)) throw new ApiError(422, 'invalid', 'Please check the details', { name: ['Enter a name'] })
      patch.name = str(input.name).slice(0, 120)
    }
    if (input.slug !== undefined) {
      const slug = str(input.slug).toLowerCase()
      if (!SLUG.test(slug)) throw new ApiError(422, 'invalid', 'Please check the details', { slug: ['Use up to 60 lowercase letters, digits and hyphens, starting with a letter or digit'] })
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
      const max = Number(s.maxSubmissions)
      patch.settings = {
        successMessage: str(s.successMessage).slice(0, 500) || undefined,
        closed: s.closed === true || undefined,
        maxSubmissions: Number.isInteger(max) && max > 0 ? max : undefined,
        exposedFields: Array.isArray(s.exposedFields) ? s.exposedFields.filter((k): k is string => typeof k === 'string').slice(0, 200) : undefined,
      }
    }
    db.update(forms).set(patch).where(eq(forms.id, form.id)).run()
    const updated = ownForm(c)
    return c.json({ form: { ...summary(updated), schema: updated.schema, settings: updated.settings, issues: checkSchema(updated.schema) } })
  })

  signedIn.post('/forms/:id/publish', (c) => {
    const form = ownForm(c)
    const errors = checkSchema(form.schema).filter((i) => i.level === 'error')
    if (errors.length) {
      throw new ApiError(422, 'schema_errors', 'Fix the problems in the form before publishing', Object.fromEntries(errors.map((e, i) => [`${i}:${e.path}`, [e.message]])))
    }
    const now = Date.now()
    db.update(forms).set({ status: 'published', publishedSchema: form.schema, publishedAt: now, updatedAt: now }).where(eq(forms.id, form.id)).run()
    return c.json({ form: summary(ownForm(c)) })
  })

  signedIn.post('/forms/:id/unpublish', (c) => {
    const form = ownForm(c)
    db.update(forms).set({ status: 'draft', updatedAt: Date.now() }).where(eq(forms.id, form.id)).run()
    return c.json({ form: summary(ownForm(c)) })
  })

  signedIn.delete('/forms/:id', (c) => {
    db.delete(forms).where(eq(forms.id, ownForm(c).id)).run()
    return c.json({ ok: true })
  })

  signedIn.get('/forms/:id/submissions', (c) => {
    const form = ownForm(c)
    const limit = Math.min(100, Math.max(1, Number(c.req.query('limit')) || 25))
    const offset = Math.max(0, Number(c.req.query('offset')) || 0)
    const q = (c.req.query('q') ?? '').trim()
    // A plain text search over the stored answers. Wildcards in the search text are matched literally.
    const pattern = `%${q.replace(/[\\%_]/g, '\\$&')}%`
    const where = q ? and(eq(submissions.formId, form.id), sql`${submissions.data} LIKE ${pattern} ESCAPE '\\'`) : eq(submissions.formId, form.id)
    const rows = db.select().from(submissions).where(where).orderBy(desc(submissions.createdAt)).limit(limit).offset(offset).all()
    const total = db.select({ n: count() }).from(submissions).where(where).get()?.n ?? 0
    return c.json({ submissions: rows, total, columns: columnsOf(form.publishedSchema ?? form.schema) })
  })

  signedIn.get('/forms/:id/submissions.csv', (c) => {
    const form = ownForm(c)
    const rows = db.select().from(submissions).where(eq(submissions.formId, form.id)).orderBy(desc(submissions.createdAt)).all()
    c.header('content-type', 'text/csv; charset=utf-8')
    c.header('content-disposition', `attachment; filename="${form.slug}-submissions.csv"`)
    return c.body(toCsv(columnsOf(form.publishedSchema ?? form.schema), rows))
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

  signedIn.get('/submissions/:id', (c) => {
    const { submission, form } = ownSubmission(c)
    return c.json({ submission, form: { id: form.id, name: form.name }, columns: columnsOf(form.publishedSchema ?? form.schema) })
  })

  signedIn.delete('/submissions/:id', (c) => {
    db.delete(submissions).where(eq(submissions.id, ownSubmission(c).submission.id)).run()
    return c.json({ ok: true })
  })

  app.route('/api', signedIn)
  return app
}

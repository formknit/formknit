import { checkSchema, validateAsync, type FormSchema, type LookupQuery } from '@formknit/core'
import { and, asc, count, desc, eq, gt, inArray, sql } from 'drizzle-orm'
import { Hono, type Context } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { cors } from 'hono/cors'
import {
  createSession, deleteSession, findSessionUser, hashPassword, newId, rateLimiter, SESSION_COOKIE, SESSION_DAYS, setSessionWorkspace,
  verifyPassword,
} from './auth'
import { columnsOf, plain, toCsv } from './csv'
import {
  apiKeys, deliveries, files, first, forms, invites, members, notes, passwordResets, sessions, STATUSES, submissions, users, versions,
  webhooks, workspaces, type Db, type FormSettings, type Status,
} from './db'
import { atLeast, isRole, NEEDS, rank, type Role } from './roles'
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
type Workspace = { id: string; name: string; role: Role }
type Env = { Variables: { user: User; viaKey: boolean; ws: Workspace } }

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

  const createWorkspace = async (userId: string, name: string) => {
    const id = newId()
    const now = Date.now()
    await db.insert(workspaces).values({ id, name: name.slice(0, 80), createdAt: now })
    await db.insert(members).values({ workspaceId: id, userId, role: 'owner', createdAt: now })
    return id
  }
  const membershipsOf = async (userId: string): Promise<Workspace[]> =>
    await db
      .select({ id: workspaces.id, name: workspaces.name, role: members.role })
      .from(members)
      .innerJoin(workspaces, eq(workspaces.id, members.workspaceId))
      .where(eq(members.userId, userId))
      .orderBy(asc(members.createdAt))
  /** The workspace a person is working in: the one their session remembers if they still belong to it. */
  const currentWorkspace = async (userId: string, preferred: string | null | undefined, userName: string) => {
    let list = await membershipsOf(userId)
    // Someone removed from every team still needs somewhere to work.
    if (!list.length) {
      await createWorkspace(userId, `${userName}'s workspace`)
      list = await membershipsOf(userId)
    }
    return { ws: list.find((w) => w.id === preferred) ?? list[0], list }
  }

  const startSession = async (c: Context, userId: string, workspaceId: string | null = null) =>
    setCookie(c, SESSION_COOKIE, await createSession(db, userId, workspaceId), {
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
    if (await first(db.select({ id: users.id }).from(users).where(eq(users.email, email)))) {
      throw new ApiError(409, 'email_taken', 'An account with this email already exists', { email: ['An account with this email already exists'] })
    }
    const user = { id: newId(), email, name }
    await db.insert(users).values({ ...user, passwordHash: await hashPassword(password), createdAt: Date.now() })
    await startSession(c, user.id, await createWorkspace(user.id, `${name}'s workspace`))
    return c.json({ user }, 201)
  })

  app.post('/api/auth/login', async (c) => {
    const input = await body(c)
    const email = str(input.email).toLowerCase()
    const password = typeof input.password === 'string' ? input.password : ''
    if (!loginLimit(`${email}|${clientOf(c)}`)) throw new ApiError(429, 'too_many', 'Too many attempts. Try again in a few minutes')
    const row = await first(db.select().from(users).where(eq(users.email, email)))
    // Hash even when the account does not exist, so the response time does not reveal which emails are registered.
    const ok = await verifyPassword(password, row?.passwordHash ?? 'scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAA')
    if (!row || !ok) throw new ApiError(401, 'bad_login', 'The email or password is not correct')
    await startSession(c, row.id)
    return c.json({ user: { id: row.id, email: row.email, name: row.name } })
  })

  app.post('/api/auth/logout', async (c) => {
    await deleteSession(db, getCookie(c, SESSION_COOKIE))
    deleteCookie(c, SESSION_COOKIE, { path: '/' })
    return c.json({ ok: true })
  })

  app.get('/api/auth/me', async (c) => {
    const found = await findSessionUser(db, getCookie(c, SESSION_COOKIE))
    if (!found) return c.json({ user: null })
    const { workspaceId, ...user } = found
    const { ws, list } = await currentWorkspace(user.id, workspaceId, user.name)
    return c.json({ user, workspace: ws, workspaces: list })
  })

  // Lets the invite page say what the invitation is before the person signs in.
  app.get('/api/auth/invite', async (c) => {
    const invite = await first(db.select().from(invites).where(and(eq(invites.id, sha256(c.req.query('token') ?? '')), gt(invites.expiresAt, Date.now()))))
    if (!invite || invite.acceptedAt) throw new ApiError(404, 'bad_invite', 'This invitation is not valid any more. Ask for a new one')
    const ws = await first(db.select({ name: workspaces.name }).from(workspaces).where(eq(workspaces.id, invite.workspaceId)))
    return c.json({ workspace: ws?.name ?? '', email: invite.email, role: invite.role })
  })

  // The answer is the same whether or not the account exists, so this cannot be used to find out who has one.
  app.post('/api/auth/forgot', async (c) => {
    const email = str((await body(c)).email).toLowerCase()
    if (!resetLimit(`${email}|${clientOf(c)}`)) throw new ApiError(429, 'too_many', 'Too many attempts. Try again in a few minutes')
    const user = await first(db.select().from(users).where(eq(users.email, email)))
    if (user) {
      const token = randomToken()
      await db.insert(passwordResets).values({ id: sha256(token), userId: user.id, expiresAt: Date.now() + 3600000 })
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
    const reset = await first(db.select().from(passwordResets).where(and(eq(passwordResets.id, id), gt(passwordResets.expiresAt, Date.now()))))
    if (!reset || reset.usedAt) throw new ApiError(400, 'bad_token', 'This reset link is not valid any more. Ask for a new one')
    await db.update(passwordResets).set({ usedAt: Date.now() }).where(eq(passwordResets.id, id))
    await db.update(users).set({ passwordHash: await hashPassword(password) }).where(eq(users.id, reset.userId))
    // Whoever knew the old password is signed out everywhere.
    await db.delete(sessions).where(eq(sessions.userId, reset.userId))
    return c.json({ ok: true })
  })

  // ---------- Public: what respondents use ----------
  const publicForm = async (slug: string) => {
    const form = await first(db.select().from(forms).where(and(eq(forms.slug, slug), eq(forms.status, 'published'))))
    if (!form?.publishedSchema) throw new ApiError(404, 'not_found', 'This form does not exist or is not published')
    return { ...form, publishedSchema: form.publishedSchema }
  }
  const submissionCount = async (formId: string) => (await first(db.select({ n: count() }).from(submissions).where(eq(submissions.formId, formId))))?.n ?? 0

  /** Why a form is not taking responses right now, or null if it is. */
  const closedReason = async (form: { id: string; settings: FormSettings }, now = Date.now()): Promise<'closed' | 'not_open' | 'ended' | 'full' | null> => {
    const s = form.settings
    if (s.closed) return 'closed'
    if (s.opensAt && now < Date.parse(s.opensAt)) return 'not_open'
    if (s.closesAt && now >= Date.parse(s.closesAt)) return 'ended'
    if (s.maxSubmissions && await submissionCount(form.id) >= s.maxSubmissions) return 'full'
    return null
  }

  app.get('/api/public/forms/:slug', async (c) => {
    const form = await publicForm(c.req.param('slug'))
    const reason = await closedReason(form)
    return c.json({ name: form.name, slug: form.slug, schema: form.publishedSchema, closed: reason !== null, reason, opensAt: form.settings.opensAt ?? null })
  })

  app.post('/api/public/forms/:slug/lookup', async (c) => {
    const form = await publicForm(c.req.param('slug'))
    if (!lookupLimit(`${form.id}|${clientOf(c)}`)) throw new ApiError(429, 'too_many', 'Too many requests. Try again shortly')
    const query = (await body(c)) as unknown as LookupQuery
    if (!isObject(query.where) || typeof query.source !== 'string' || !schemaAllows(form.publishedSchema, query)) {
      throw new ApiError(403, 'not_allowed', 'This form does not define that lookup')
    }
    return c.json({ value: (await makeLookup(db, form.workspaceId)(query)) ?? null })
  })

  // Uploads are accepted only for a file field the form really has, within that field's own limits.
  app.post('/api/public/forms/:slug/files', async (c) => {
    const form = await publicForm(c.req.param('slug'))
    if (!uploadLimit(`${form.id}|${clientOf(c)}`)) throw new ApiError(429, 'too_many', 'Too many uploads. Try again in a minute')
    if (await closedReason(form)) throw new ApiError(403, 'closed', 'This form is not accepting responses')
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
    await db.insert(files).values({ id, formId: form.id, name, size: upload.size, type: upload.type.slice(0, 100) || 'application/octet-stream', createdAt: Date.now() })
    return c.json({ id, name, size: upload.size, type: upload.type, url: `/api/files/${id}` }, 201)
  })

  /** Tells the form's owner and any webhooks about something that happened to a submission. */
  const announce = async (form: typeof forms.$inferSelect, event: string, submission: { id: string; status: Status; createdAt: number; data: Record<string, unknown> }) => {
    const hooks = await db.select().from(webhooks).where(and(eq(webhooks.formId, form.id), eq(webhooks.active, true)))
    for (const hook of hooks) background(deliver(db, fetcher, hook, event, { form: { id: form.id, name: form.name, slug: form.slug }, submission }))
    if (event !== 'submission.created') return
    const lines = columnsOf(form.publishedSchema ?? form.schema).map((col) => {
      const value = plain(col, submission.data[col.key])
      return `${col.label}: ${value === null || value === undefined ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value)}`
    })
    for (const to of form.settings.notifyEmails ?? []) {
      background(mail({ to, subject: `New submission: ${form.name}`, text: `${lines.join('\n')}\n\nOpen it: ${webOrigins[0]}/submissions/${submission.id}` }))
    }
  }

  app.post('/api/public/forms/:slug/submissions', async (c) => {
    const form = await publicForm(c.req.param('slug'))
    if (!submitLimit(`${form.id}|${clientOf(c)}`)) throw new ApiError(429, 'too_many', 'Too many submissions. Try again in a minute')
    if (await closedReason(form)) throw new ApiError(403, 'closed', 'This form is not accepting responses')
    // Lookups are fetched again here and formulas recalculated, so nothing the browser sent is trusted.
    const result = await validateAsync(form.publishedSchema, await body(c), { lookup: makeLookup(db, form.workspaceId) })
    if (!result.valid) throw new ApiError(422, 'invalid', 'Some answers need attention', result.errors)
    const row = { id: newId(), formId: form.id, data: result.data, status: 'new' as const, createdAt: Date.now() }
    await db.insert(submissions).values(row)
    await announce(form, 'submission.created', row)
    return c.json({ id: row.id, message: form.settings.successMessage || 'Thank you. Your response has been recorded.' }, 201)
  })

  // ---------- Signed-in only from here ----------
  const signedIn = new Hono<Env>()
  signedIn.use('*', async (c, next) => {
    const found = await findSessionUser(db, getCookie(c, SESSION_COOKIE))
    const bearer = c.req.header('authorization')?.match(/^Bearer (fk_[A-Za-z0-9_-]+)$/)?.[1]
    if (found) {
      const { workspaceId, ...user } = found
      c.set('user', user)
      c.set('viaKey', false)
      c.set('ws', (await currentWorkspace(user.id, workspaceId, user.name)).ws)
      return next()
    }
    if (bearer) {
      // API keys can read one workspace and change nothing.
      if (c.req.method !== 'GET') throw new ApiError(403, 'read_only', 'API keys can only read data')
      const key = await first(db.select().from(apiKeys).where(eq(apiKeys.id, sha256(bearer))))
      const user = key && await first(db.select({ id: users.id, email: users.email, name: users.name }).from(users).where(eq(users.id, key.userId)))
      // The key stops working if its creator has left the workspace.
      const ws = user && (await membershipsOf(user.id)).find((w) => w.id === key.workspaceId)
      if (key && user && ws) {
        await db.update(apiKeys).set({ lastUsedAt: Date.now() }).where(eq(apiKeys.id, key.id))
        c.set('user', user)
        c.set('viaKey', true)
        c.set('ws', { ...ws, role: 'viewer' })
        return next()
      }
    }
    throw new ApiError(401, 'signed_out', 'Sign in to continue')
  })
  /** Stops the request unless the person's role in this workspace is high enough. */
  const need = (c: Context<Env>, what: keyof typeof NEEDS) => {
    if (!atLeast(c.get('ws').role, NEEDS[what])) throw new ApiError(403, 'forbidden', `Your role (${c.get('ws').role}) cannot do this. It needs ${NEEDS[what]} or above`)
  }
  /** Account management needs a real sign-in, not an API key. */
  const sessionOnly = (c: Context<Env>) => {
    if (c.get('viaKey')) throw new ApiError(403, 'session_required', 'This needs a signed-in session, not an API key')
  }

  signedIn.patch('/auth/profile', async (c) => {
    sessionOnly(c)
    const name = str((await body(c)).name)
    if (!name) throw new ApiError(422, 'invalid', 'Please check the details', { name: ['Enter your name'] })
    await db.update(users).set({ name: name.slice(0, 120) }).where(eq(users.id, c.get('user').id))
    return c.json({ user: { ...c.get('user'), name: name.slice(0, 120) } })
  })

  signedIn.post('/auth/password', async (c) => {
    sessionOnly(c)
    const input = await body(c)
    const next = typeof input.newPassword === 'string' ? input.newPassword : ''
    const row = (await first(db.select().from(users).where(eq(users.id, c.get('user').id))))!
    if (!(await verifyPassword(typeof input.currentPassword === 'string' ? input.currentPassword : '', row.passwordHash))) {
      throw new ApiError(422, 'invalid', 'Please check the details', { currentPassword: ['That is not your current password'] })
    }
    const weak = checkPassword(next)
    if (weak) throw new ApiError(422, 'invalid', 'Please check the details', { newPassword: [weak] })
    await db.update(users).set({ passwordHash: await hashPassword(next) }).where(eq(users.id, row.id))
    // Sign out every other device, and give this one a fresh session.
    await db.delete(sessions).where(eq(sessions.userId, row.id))
    await startSession(c, row.id, c.get('ws').id)
    return c.json({ ok: true })
  })

  // ---------- Workspaces and teams ----------
  signedIn.post('/workspaces', async (c) => {
    sessionOnly(c)
    const name = str((await body(c)).name)
    if (!name) throw new ApiError(422, 'invalid', 'Please check the details', { name: ['Enter a name'] })
    const id = await createWorkspace(c.get('user').id, name)
    await setSessionWorkspace(db, getCookie(c, SESSION_COOKIE), id)
    return c.json({ workspace: { id, name: name.slice(0, 80), role: 'owner' } }, 201)
  })

  signedIn.post('/workspaces/switch', async (c) => {
    sessionOnly(c)
    const wanted = str((await body(c)).id)
    const ws = (await membershipsOf(c.get('user').id)).find((w) => w.id === wanted)
    if (!ws) throw new ApiError(404, 'not_found', 'You are not a member of that workspace')
    await setSessionWorkspace(db, getCookie(c, SESSION_COOKIE), ws.id)
    return c.json({ workspace: ws })
  })

  signedIn.patch('/workspace', async (c) => {
    sessionOnly(c)
    need(c, 'own')
    const name = str((await body(c)).name)
    if (!name) throw new ApiError(422, 'invalid', 'Please check the details', { name: ['Enter a name'] })
    await db.update(workspaces).set({ name: name.slice(0, 80) }).where(eq(workspaces.id, c.get('ws').id))
    return c.json({ workspace: { ...c.get('ws'), name: name.slice(0, 80) } })
  })

  signedIn.get('/workspace/members', async (c) => {
    sessionOnly(c)
    const ws = c.get('ws')
    const people = await db
      .select({ id: users.id, name: users.name, email: users.email, role: members.role, joinedAt: members.createdAt })
      .from(members)
      .innerJoin(users, eq(users.id, members.userId))
      .where(eq(members.workspaceId, ws.id))
      .orderBy(asc(members.createdAt))
    // Only people who can manage the team see who has been invited.
    const pending = atLeast(ws.role, 'admin')
      ? (
          await db
            .select({ id: invites.id, email: invites.email, role: invites.role, expiresAt: invites.expiresAt, createdAt: invites.createdAt })
            .from(invites)
            .where(and(eq(invites.workspaceId, ws.id), gt(invites.expiresAt, Date.now())))
        ).filter((i) => !people.some((p) => p.email === i.email))
      : []
    return c.json({ members: people, invites: pending })
  })

  /** A role someone may hand out: always below their own, except that an owner may make admins. */
  const mayGrant = (mine: Role, role: Role) => role !== 'owner' && rank(role) < rank(mine)

  signedIn.post('/workspace/invites', async (c) => {
    sessionOnly(c)
    need(c, 'manage')
    const ws = c.get('ws')
    const input = await body(c)
    const email = str(input.email).toLowerCase()
    const role = input.role
    if (!EMAIL.test(email)) throw new ApiError(422, 'invalid', 'Please check the details', { email: ['Enter a valid email address'] })
    if (!isRole(role) || !mayGrant(ws.role, role)) throw new ApiError(422, 'invalid', 'Please check the details', { role: ['You cannot give that role'] })
    const existing = await first(db.select({ id: users.id }).from(users).innerJoin(members, eq(members.userId, users.id)).where(and(eq(users.email, email), eq(members.workspaceId, ws.id))))
    if (existing) throw new ApiError(409, 'already_member', 'That person is already a member', { email: ['That person is already a member'] })
    // A new invitation replaces any earlier one to the same address.
    await db.delete(invites).where(and(eq(invites.workspaceId, ws.id), eq(invites.email, email)))
    const token = randomToken()
    const now = Date.now()
    await db.insert(invites).values({ id: sha256(token), workspaceId: ws.id, email, role, invitedBy: c.get('user').id, expiresAt: now + 7 * DAY, createdAt: now })
    background(
      mail({
        to: email,
        subject: `${c.get('user').name} invited you to ${ws.name} on Formknit`,
        text: `${c.get('user').name} has invited you to join "${ws.name}" as ${role}.\n\nAccept the invitation (it works for 7 days):\n\n${webOrigins[0]}/invite?token=${token}\n\nSign in or create an account with this email address (${email}) to accept.`,
      }),
    )
    return c.json({ ok: true }, 201)
  })

  signedIn.delete('/workspace/invites/:inviteId', async (c) => {
    sessionOnly(c)
    need(c, 'manage')
    await db.delete(invites).where(and(eq(invites.id, c.req.param('inviteId')), eq(invites.workspaceId, c.get('ws').id)))
    return c.json({ ok: true })
  })

  // Accepting needs the invited person themselves: signed in with the address the invitation was sent to.
  signedIn.post('/invites/accept', async (c) => {
    sessionOnly(c)
    const id = sha256(str((await body(c)).token))
    const invite = await first(db.select().from(invites).where(and(eq(invites.id, id), gt(invites.expiresAt, Date.now()))))
    if (!invite || invite.acceptedAt) throw new ApiError(404, 'bad_invite', 'This invitation is not valid any more. Ask for a new one')
    if (invite.email !== c.get('user').email) throw new ApiError(403, 'wrong_account', `This invitation was sent to ${invite.email}. Sign in with that address to accept it`)
    const now = Date.now()
    await db.update(invites).set({ acceptedAt: now }).where(eq(invites.id, id))
    const already = (await membershipsOf(c.get('user').id)).some((w) => w.id === invite.workspaceId)
    if (!already) await db.insert(members).values({ workspaceId: invite.workspaceId, userId: c.get('user').id, role: invite.role, createdAt: now })
    await setSessionWorkspace(db, getCookie(c, SESSION_COOKIE), invite.workspaceId)
    return c.json({ workspace: (await membershipsOf(c.get('user').id)).find((w) => w.id === invite.workspaceId) })
  })

  const memberOf = async (c: Context<Env>) => {
    const target = await first(db.select().from(members).where(and(eq(members.workspaceId, c.get('ws').id), eq(members.userId, c.req.param('userId') ?? ''))))
    if (!target) throw new ApiError(404, 'not_found', 'That person is not a member')
    return target
  }

  signedIn.patch('/workspace/members/:userId', async (c) => {
    sessionOnly(c)
    need(c, 'manage')
    const ws = c.get('ws')
    const target = await memberOf(c)
    const role = (await body(c)).role
    // You can only change people below you, and only to roles below you.
    if (target.userId === c.get('user').id || rank(target.role) >= rank(ws.role)) throw new ApiError(403, 'forbidden', 'You cannot change this person')
    if (!isRole(role) || !mayGrant(ws.role, role)) throw new ApiError(422, 'invalid', 'You cannot give that role')
    await db.update(members).set({ role }).where(and(eq(members.workspaceId, ws.id), eq(members.userId, target.userId)))
    return c.json({ ok: true })
  })

  signedIn.delete('/workspace/members/:userId', async (c) => {
    sessionOnly(c)
    const ws = c.get('ws')
    const target = await memberOf(c)
    const self = target.userId === c.get('user').id
    if (self && target.role === 'owner') throw new ApiError(403, 'forbidden', 'The owner cannot leave the workspace')
    if (!self) {
      need(c, 'manage')
      if (rank(target.role) >= rank(ws.role)) throw new ApiError(403, 'forbidden', 'You cannot remove this person')
    }
    await db.delete(members).where(and(eq(members.workspaceId, ws.id), eq(members.userId, target.userId)))
    // Their keys for this workspace stop working, and their sessions fall back to another workspace.
    await db.delete(apiKeys).where(and(eq(apiKeys.workspaceId, ws.id), eq(apiKeys.userId, target.userId)))
    return c.json({ ok: true })
  })

  signedIn.get('/api-keys', async (c) => {
    sessionOnly(c)
    const rows = await db
      .select({ id: apiKeys.id, name: apiKeys.name, prefix: apiKeys.prefix, createdAt: apiKeys.createdAt, lastUsedAt: apiKeys.lastUsedAt })
      .from(apiKeys)
      .where(and(eq(apiKeys.userId, c.get('user').id), eq(apiKeys.workspaceId, c.get('ws').id)))
      .orderBy(desc(apiKeys.createdAt))
    return c.json({ keys: rows })
  })
  signedIn.post('/api-keys', async (c) => {
    sessionOnly(c)
    const name = str((await body(c)).name).slice(0, 80) || 'API key'
    const key = `fk_${randomToken(24)}`
    await db.insert(apiKeys).values({ id: sha256(key), userId: c.get('user').id, workspaceId: c.get('ws').id, name, prefix: key.slice(0, 10), createdAt: Date.now() })
    // The only time the key is ever shown.
    return c.json({ key, name, prefix: key.slice(0, 10) }, 201)
  })
  signedIn.delete('/api-keys/:id', async (c) => {
    sessionOnly(c)
    await db.delete(apiKeys).where(and(eq(apiKeys.id, c.req.param('id')), eq(apiKeys.userId, c.get('user').id)))
    return c.json({ ok: true })
  })

  /** Loads a form and checks it belongs to the current workspace. Other workspaces' forms look like they do not exist. */
  const ownForm = async (c: Context<Env>, id = c.req.param('id') ?? '') => {
    const form = await first(db.select().from(forms).where(and(eq(forms.id, id), eq(forms.workspaceId, c.get('ws').id))))
    if (!form) throw new ApiError(404, 'not_found', 'Form not found')
    return form
  }
  const uniqueSlug = async (base: string, exceptId?: string) => {
    for (let n = 1; ; n++) {
      const slug = n === 1 ? base : `${base}-${n}`
      const taken = await first(db.select({ id: forms.id }).from(forms).where(eq(forms.slug, slug)))
      if (!taken || taken.id === exceptId) return slug
    }
  }
  const summary = async (form: typeof forms.$inferSelect) => ({
    id: form.id,
    name: form.name,
    slug: form.slug,
    status: form.status,
    publishedAt: form.publishedAt,
    updatedAt: form.updatedAt,
    submissions: await submissionCount(form.id),
    // True when the builder has changes that respondents cannot see yet.
    unpublishedChanges: form.status === 'published' && JSON.stringify(form.schema) !== JSON.stringify(form.publishedSchema),
    closedReason: form.status === 'published' ? await closedReason(form) : null,
  })
  const detail = async (form: typeof forms.$inferSelect) => ({ ...(await summary(form)), schema: form.schema, settings: form.settings, issues: checkSchema(form.schema) })

  signedIn.get('/dashboard', async (c) => {
    const mine = await db.select().from(forms).where(eq(forms.workspaceId, c.get('ws').id))
    const ids = mine.map((f) => f.id)
    const rows = ids.length ? await db.select().from(submissions).where(inArray(submissions.formId, ids)).orderBy(desc(submissions.createdAt)) : []
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

  signedIn.get('/templates', async (c) => c.json({ templates: TEMPLATES.map(({ id, name, description, schema }) => ({ id, name, description, fields: columnsOf(schema).length })) }))

  signedIn.get('/forms', async (c) => {
    const rows = await db.select().from(forms).where(eq(forms.workspaceId, c.get('ws').id)).orderBy(desc(forms.updatedAt))
    return c.json({ forms: await Promise.all(rows.map(summary)) })
  })

  const insertForm = async (c: Context<Env>, name: string, schema: FormSchema, settings: FormSettings = {}) => {
    const now = Date.now()
    const form = {
      id: newId(), ownerId: c.get('user').id, workspaceId: c.get('ws').id, name, slug: await uniqueSlug(slugify(name)), status: 'draft' as const, schema,
      publishedSchema: null, publishedAt: null, settings, createdAt: now, updatedAt: now,
    }
    await db.insert(forms).values(form)
    return form
  }

  signedIn.post('/forms', async (c) => {
    need(c, 'edit')
    const input = await body(c)
    const template = input.template ? TEMPLATES.find((t) => t.id === input.template) : undefined
    if (input.template && !template) throw new ApiError(422, 'invalid', 'That template does not exist')
    const name = (str(input.name) || template?.name || 'Untitled form').slice(0, 120)
    const given = isObject(input.schema) && Array.isArray(input.schema.pages) ? (input.schema as unknown as FormSchema) : undefined
    const schema = given ?? (template ? { ...template.schema, title: name } : blankSchema(name))
    return c.json({ form: await detail(await insertForm(c, name, schema)) }, 201)
  })

  signedIn.post('/forms/:id/duplicate', async (c) => {
    need(c, 'edit')
    const source = await ownForm(c)
    // The copy starts as an unpublished draft with the same design and settings, and no submissions.
    const { exposedFields: _unused, ...settings } = source.settings
    return c.json({ form: await detail(await insertForm(c, `${source.name} (copy)`.slice(0, 120), source.schema, settings)) }, 201)
  })

  signedIn.get('/forms/:id', async (c) => c.json({ form: await detail(await ownForm(c)) }))

  signedIn.patch('/forms/:id', async (c) => {
    need(c, 'edit')
    const form = await ownForm(c)
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
      if (await uniqueSlug(slug, form.id) !== slug) throw new ApiError(409, 'slug_taken', 'That address is already used by another form', { slug: ['That address is already used by another form'] })
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
    await db.update(forms).set(patch).where(eq(forms.id, form.id))
    return c.json({ form: await detail(await ownForm(c)) })
  })

  signedIn.post('/forms/:id/publish', async (c) => {
    need(c, 'edit')
    const form = await ownForm(c)
    const errors = checkSchema(form.schema).filter((i) => i.level === 'error')
    if (errors.length) {
      throw new ApiError(422, 'schema_errors', 'Fix the problems in the form before publishing', Object.fromEntries(errors.map((e, i) => [`${i}:${e.path}`, [e.message]])))
    }
    const now = Date.now()
    // Publishing the same design twice does not create a new version.
    if (JSON.stringify(form.schema) !== JSON.stringify(form.publishedSchema) || form.status !== 'published') {
      const last = await first(db.select({ v: versions.version, schema: versions.schema }).from(versions).where(eq(versions.formId, form.id)).orderBy(desc(versions.version)).limit(1))
      if (!last || JSON.stringify(last.schema) !== JSON.stringify(form.schema)) {
        await db.insert(versions).values({ id: newId(), formId: form.id, version: (last?.v ?? 0) + 1, schema: form.schema, publishedAt: now })
      }
    }
    await db.update(forms).set({ status: 'published', publishedSchema: form.schema, publishedAt: now, updatedAt: now }).where(eq(forms.id, form.id))
    return c.json({ form: await summary(await ownForm(c)) })
  })

  signedIn.post('/forms/:id/unpublish', async (c) => {
    need(c, 'edit')
    const form = await ownForm(c)
    await db.update(forms).set({ status: 'draft', updatedAt: Date.now() }).where(eq(forms.id, form.id))
    return c.json({ form: await summary(await ownForm(c)) })
  })

  signedIn.delete('/forms/:id', async (c) => {
    need(c, 'manage')
    const form = await ownForm(c)
    for (const file of await db.select({ id: files.id }).from(files).where(eq(files.formId, form.id))) await storage.remove(file.id)
    await db.delete(forms).where(eq(forms.id, form.id))
    return c.json({ ok: true })
  })

  signedIn.get('/forms/:id/versions', async (c) => {
    const form = await ownForm(c)
    const rows = await db.select().from(versions).where(eq(versions.formId, form.id)).orderBy(desc(versions.version))
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
  signedIn.post('/forms/:id/versions/:versionId/restore', async (c) => {
    need(c, 'edit')
    const form = await ownForm(c)
    const version = await first(db.select().from(versions).where(and(eq(versions.id, c.req.param('versionId')), eq(versions.formId, form.id))))
    if (!version) throw new ApiError(404, 'not_found', 'Version not found')
    await db.update(forms).set({ schema: version.schema, updatedAt: Date.now() }).where(eq(forms.id, form.id))
    return c.json({ form: await detail(await ownForm(c)) })
  })

  signedIn.get('/forms/:id/report', async (c) => {
    const form = await ownForm(c)
    const rows = await db.select({ data: submissions.data, status: submissions.status, createdAt: submissions.createdAt }).from(submissions).where(eq(submissions.formId, form.id))
    return c.json({ report: buildReport(form.publishedSchema ?? form.schema, rows) })
  })

  // ---------- Webhooks ----------
  signedIn.get('/forms/:id/webhooks', async (c) => {
    need(c, 'edit')
    const form = await ownForm(c)
    const hooks = await db.select().from(webhooks).where(eq(webhooks.formId, form.id)).orderBy(asc(webhooks.createdAt))
    return c.json({
      webhooks: await Promise.all(
        hooks.map(async (h) => ({
        id: h.id,
        url: h.url,
        active: h.active,
        secret: h.secret,
        last: (await first(db.select().from(deliveries).where(eq(deliveries.webhookId, h.id)).orderBy(desc(deliveries.createdAt)).limit(1))) ?? null,
        })),
      ),
    })
  })
  signedIn.post('/forms/:id/webhooks', async (c) => {
    need(c, 'edit')
    const form = await ownForm(c)
    const url = str((await body(c)).url)
    const problem = webhookUrlProblem(url, allowPrivateWebhooks)
    if (problem) throw new ApiError(422, 'invalid', 'Please check the details', { url: [problem] })
    if (((await first(db.select({ n: count() }).from(webhooks).where(eq(webhooks.formId, form.id))))?.n ?? 0) >= 10) throw new ApiError(422, 'invalid', 'A form can have at most 10 webhooks')
    const hook = { id: newId(), formId: form.id, url, secret: `whsec_${randomToken(24)}`, active: true, createdAt: Date.now() }
    await db.insert(webhooks).values(hook)
    return c.json({ webhook: { id: hook.id, url: hook.url, active: true, secret: hook.secret, last: null } }, 201)
  })
  const ownHook = async (c: Context<Env>) => {
    const hook = await first(db.select().from(webhooks).where(and(eq(webhooks.id, c.req.param('hookId') ?? ''), eq(webhooks.formId, (await ownForm(c)).id))))
    if (!hook) throw new ApiError(404, 'not_found', 'Webhook not found')
    return hook
  }
  signedIn.patch('/forms/:id/webhooks/:hookId', async (c) => {
    need(c, 'edit')
    const hook = await ownHook(c)
    await db.update(webhooks).set({ active: (await body(c)).active === true }).where(eq(webhooks.id, hook.id))
    return c.json({ ok: true })
  })
  signedIn.delete('/forms/:id/webhooks/:hookId', async (c) => {
    need(c, 'edit')
    await db.delete(webhooks).where(eq(webhooks.id, (await ownHook(c)).id))
    return c.json({ ok: true })
  })
  signedIn.post('/forms/:id/webhooks/:hookId/test', async (c) => {
    need(c, 'edit')
    const hook = await ownHook(c)
    const form = await ownForm(c)
    const result = await deliver(db, fetcher, hook, 'webhook.test', { form: { id: form.id, name: form.name, slug: form.slug }, submission: null })
    return c.json({ result })
  })

  // ---------- Submissions ----------
  signedIn.get('/forms/:id/submissions', async (c) => {
    const form = await ownForm(c)
    const limit = Math.min(100, Math.max(1, Number(c.req.query('limit')) || 25))
    const offset = Math.max(0, Number(c.req.query('offset')) || 0)
    const q = (c.req.query('q') ?? '').trim()
    const status = STATUSES.find((s) => s === c.req.query('status'))
    // A plain text search over the stored answers. Wildcards in the search text are matched literally.
    const pattern = `%${q.replace(/[\\%_]/g, '\\$&')}%`
    const where = and(
      eq(submissions.formId, form.id),
      q ? sql`lower(${submissions.data}) LIKE lower(${pattern}) ESCAPE '\\'` : undefined,
      status ? eq(submissions.status, status) : undefined,
    )
    const rows = await db.select().from(submissions).where(where).orderBy(desc(submissions.createdAt)).limit(limit).offset(offset)
    const total = (await first(db.select({ n: count() }).from(submissions).where(where)))?.n ?? 0
    return c.json({ submissions: rows, total, columns: columnsOf(form.publishedSchema ?? form.schema) })
  })

  signedIn.get('/forms/:id/submissions.csv', async (c) => {
    const form = await ownForm(c)
    const rows = await db.select().from(submissions).where(eq(submissions.formId, form.id)).orderBy(desc(submissions.createdAt))
    const columns = [...columnsOf(form.publishedSchema ?? form.schema), { key: '__status', label: 'Status' }]
    c.header('content-type', 'text/csv; charset=utf-8')
    c.header('content-disposition', `attachment; filename="${form.slug}-submissions.csv"`)
    return c.body(toCsv(columns, rows.map((r) => ({ ...r, data: { ...r.data, __status: r.status } }))))
  })

  const ownSubmission = async (c: Context<Env>) => {
    const row = await first(db
      .select({ submission: submissions, form: forms })
      .from(submissions)
      .innerJoin(forms, eq(forms.id, submissions.formId))
      .where(and(eq(submissions.id, c.req.param('id') ?? ''), eq(forms.workspaceId, c.get('ws').id))))
    if (!row) throw new ApiError(404, 'not_found', 'Submission not found')
    return row
  }
  const notesOf = async (submissionId: string) =>
    await db
      .select({ id: notes.id, body: notes.body, createdAt: notes.createdAt, author: users.name })
      .from(notes)
      .innerJoin(users, eq(users.id, notes.userId))
      .where(eq(notes.submissionId, submissionId))
      .orderBy(asc(notes.createdAt))

  signedIn.get('/submissions/:id', async (c) => {
    const { submission, form } = await ownSubmission(c)
    return c.json({
      submission,
      form: { id: form.id, name: form.name },
      schema: form.publishedSchema ?? form.schema,
      columns: columnsOf(form.publishedSchema ?? form.schema),
      notes: await notesOf(submission.id),
    })
  })

  signedIn.patch('/submissions/:id', async (c) => {
    const { submission, form } = await ownSubmission(c)
    const input = await body(c)
    const patch: Partial<typeof submissions.$inferInsert> = { updatedAt: Date.now() }
    need(c, input.data !== undefined ? 'edit' : 'review')
    if (input.status !== undefined) {
      const status = STATUSES.find((s) => s === input.status)
      if (!status) throw new ApiError(422, 'invalid', 'That is not a valid status')
      patch.status = status
    }
    if (input.data !== undefined) {
      if (!isObject(input.data)) throw new ApiError(422, 'invalid', 'The answers must be an object')
      // Edited answers go through the same checks as a new submission.
      const result = await validateAsync(form.publishedSchema ?? form.schema, input.data, { lookup: makeLookup(db, form.workspaceId) })
      if (!result.valid) throw new ApiError(422, 'invalid', 'Some answers need attention', result.errors)
      patch.data = result.data
    }
    await db.update(submissions).set(patch).where(eq(submissions.id, submission.id))
    const updated = (await ownSubmission(c)).submission
    if (patch.status && patch.status !== submission.status) await announce(form, 'submission.status_changed', updated)
    return c.json({ submission: updated })
  })

  signedIn.post('/submissions/:id/notes', async (c) => {
    need(c, 'review')
    const { submission } = await ownSubmission(c)
    const text = str((await body(c)).body)
    if (!text) throw new ApiError(422, 'invalid', 'Please check the details', { body: ['Write a note first'] })
    await db.insert(notes).values({ id: newId(), submissionId: submission.id, userId: c.get('user').id, body: text.slice(0, 4000), createdAt: Date.now() })
    return c.json({ notes: await notesOf(submission.id) }, 201)
  })

  signedIn.delete('/submissions/:id', async (c) => {
    need(c, 'edit')
    await db.delete(submissions).where(eq(submissions.id, (await ownSubmission(c)).submission.id))
    return c.json({ ok: true })
  })

  // Uploaded files are private: only the form's owner can download them.
  signedIn.get('/files/:id', async (c) => {
    const row = await first(db
      .select({ file: files })
      .from(files)
      .innerJoin(forms, eq(forms.id, files.formId))
      .where(and(eq(files.id, c.req.param('id')), eq(forms.workspaceId, c.get('ws').id))))
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

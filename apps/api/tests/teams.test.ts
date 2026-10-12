import { form, text } from '@formknit/core'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../src/app'
import { createDb, POSTGRES, type Db } from '../src/db'
import { openTestDb, query } from './helpers'
import { createMailer, type Mail } from '../src/services'

const ORIGIN = 'http://localhost:5175'
const PASSWORD = 'a-long-test-password'
let db: Db
let app: ReturnType<typeof createApp>
let sent: Mail[]

beforeEach(async () => {
  db = await openTestDb()
  sent = []
  app = createApp({ db, webOrigins: [ORIGIN], mailer: createMailer(db, async (mail) => void sent.push(mail)) })
})
afterEach(() => db.close())

function client() {
  let cookie = ''
  const call = async (method: string, path: string, body?: unknown, headers: Record<string, string> = {}) => {
    const res = await app.request(path, {
      method,
      headers: { 'content-type': 'application/json', origin: ORIGIN, ...(cookie ? { cookie } : {}), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const set = res.headers.get('set-cookie')
    if (set) cookie = set.split(';')[0]
    const text = await res.text()
    let json: any = null
    try {
      json = JSON.parse(text)
    } catch {
      // Not JSON.
    }
    return { status: res.status, json, text }
  }
  return {
    get: (path: string, headers?: Record<string, string>) => call('GET', path, undefined, headers),
    post: (path: string, body?: unknown) => call('POST', path, body ?? {}),
    patch: (path: string, body: unknown) => call('PATCH', path, body),
    del: (path: string) => call('DELETE', path),
  }
}

async function account(name: string) {
  const c = client()
  const email = `${name.toLowerCase()}@example.com`
  const res = await c.post('/api/auth/register', { name, email, password: PASSWORD })
  expect(res.status).toBe(201)
  return Object.assign(c, { email, id: res.json.user.id as string })
}

/** Invites someone to the inviter's current workspace and has them accept. */
async function join(inviter: ReturnType<typeof client>, person: Awaited<ReturnType<typeof account>>, role: string) {
  sent.length = 0
  expect((await inviter.post('/api/workspace/invites', { email: person.email, role })).status).toBe(201)
  await app.idle()
  const token = sent[0].text.match(/invite\?token=([\w-]+)/)![1]
  const accepted = await person.post('/api/invites/accept', { token })
  expect(accepted.status).toBe(200)
  return token
}

const schema = form('Survey', [text('name').label('Name').required()])

describe('workspaces', () => {
  it('gives each account its own workspace and keeps workspaces apart', async () => {
    const sita = await account('Sita')
    const me = (await sita.get('/api/auth/me')).json
    expect(me.workspace).toMatchObject({ name: "Sita's workspace", role: 'owner' })
    expect(me.workspaces).toHaveLength(1)

    const made = (await sita.post('/api/forms', { name: 'Personal form' })).json.form
    const second = (await sita.post('/api/workspaces', { name: 'School' })).json.workspace
    expect(second).toMatchObject({ name: 'School', role: 'owner' })
    // Creating a workspace switches to it, and it starts empty.
    expect((await sita.get('/api/forms')).json.forms).toEqual([])
    expect((await sita.get(`/api/forms/${made.id}`)).status).toBe(404)
    await sita.post('/api/forms', { name: 'School form' })

    await sita.post('/api/workspaces/switch', { id: me.workspace.id })
    expect((await sita.get('/api/forms')).json.forms.map((f: any) => f.name)).toEqual(['Personal form'])
    expect((await sita.post('/api/workspaces/switch', { id: 'someone-elses' })).status).toBe(404)
    expect((await sita.get('/api/auth/me')).json.workspaces.map((w: any) => w.name)).toEqual(["Sita's workspace", 'School'])

    expect((await sita.patch('/api/workspace', { name: 'Home' })).json.workspace.name).toBe('Home')
    expect((await sita.patch('/api/workspace', { name: ' ' })).status).toBe(422)
  })
})

describe('invitations', () => {
  it('invites by email and lets only the invited person accept, once', async () => {
    const owner = await account('Owner')
    const maya = await account('Maya')
    const stranger = await account('Stranger')

    expect((await owner.post('/api/workspace/invites', { email: 'nope', role: 'editor' })).json.error.fields).toHaveProperty('email')
    expect((await owner.post('/api/workspace/invites', { email: maya.email, role: 'owner' })).json.error.fields).toHaveProperty('role')
    expect((await owner.post('/api/workspace/invites', { email: maya.email, role: 'wizard' })).status).toBe(422)

    await owner.post('/api/workspace/invites', { email: 'MAYA@example.com', role: 'editor' })
    await app.idle()
    expect(sent).toHaveLength(1)
    expect(sent[0]).toMatchObject({ to: maya.email, subject: "Owner invited you to Owner's workspace on Formknit" })
    const token = sent[0].text.match(/invite\?token=([\w-]+)/)![1]
    expect(JSON.stringify(await query(db, 'SELECT * FROM invites'))).not.toContain(token)

    expect(await (await app.request(`/api/auth/invite?token=${token}`)).json()).toEqual({ workspace: "Owner's workspace", email: maya.email, role: 'editor' })
    expect((await app.request('/api/auth/invite?token=wrong')).status).toBe(404)
    expect((await owner.get('/api/workspace/members')).json.invites).toMatchObject([{ email: maya.email, role: 'editor' }])

    expect((await stranger.post('/api/invites/accept', { token })).status).toBe(403)
    expect((await client().post('/api/invites/accept', { token })).status).toBe(401)
    const accepted = await maya.post('/api/invites/accept', { token })
    expect(accepted.json.workspace).toMatchObject({ name: "Owner's workspace", role: 'editor' })
    expect((await maya.post('/api/invites/accept', { token })).status).toBe(404)

    // Accepting switches her into the team, and she keeps her own workspace too.
    const me = (await maya.get('/api/auth/me')).json
    expect(me.workspace).toMatchObject({ name: "Owner's workspace", role: 'editor' })
    expect(me.workspaces).toHaveLength(2)
    const listed = (await owner.get('/api/workspace/members')).json
    expect(listed.members.map((m: any) => [m.name, m.role])).toEqual([['Owner', 'owner'], ['Maya', 'editor']])
    expect(listed.invites).toEqual([])
    expect((await owner.post('/api/workspace/invites', { email: maya.email, role: 'viewer' })).status).toBe(409)
  })

  it('expires, can be withdrawn, and a new invite replaces the old one', async () => {
    const owner = await account('Owner')
    const maya = await account('Maya')
    await owner.post('/api/workspace/invites', { email: maya.email, role: 'viewer' })
    await owner.post('/api/workspace/invites', { email: maya.email, role: 'editor' })
    await app.idle()
    const [first, second] = sent.map((m) => m.text.match(/invite\?token=([\w-]+)/)![1])
    expect((await maya.post('/api/invites/accept', { token: first })).status).toBe(404)

    const pending = (await owner.get('/api/workspace/members')).json.invites
    expect(pending).toHaveLength(1)
    await owner.del(`/api/workspace/invites/${pending[0].id}`)
    expect((await maya.post('/api/invites/accept', { token: second })).status).toBe(404)

    await owner.post('/api/workspace/invites', { email: maya.email, role: 'editor' })
    await app.idle()
    const third = sent[2].text.match(/invite\?token=([\w-]+)/)![1]
    await query(db, 'UPDATE invites SET expires_at = 1')
    expect((await maya.post('/api/invites/accept', { token: third })).status).toBe(404)
  })
})

describe('roles', () => {
  async function team() {
    const owner = await account('Owner')
    const created = (await owner.post('/api/forms', { name: 'Survey', schema })).json.form
    await owner.post(`/api/forms/${created.id}/publish`)
    const submission = (await client().post(`/api/public/forms/${created.slug}/submissions`, { name: 'A' })).json.id as string
    const add = async (role: string) => {
      const person = await account(role[0].toUpperCase() + role.slice(1))
      await join(owner, person, role)
      return person
    }
    const viewer = await add('viewer')
    const reviewer = await add('reviewer')
    const editor = await add('editor')
    const admin = await add('admin')
    return { owner, formId: created.id as string, slug: created.slug as string, submission, viewer, reviewer, editor, admin }
  }

  it('lets each role do exactly what it should', async () => {
    const t = await team()
    const form = `/api/forms/${t.formId}`
    const sub = `/api/submissions/${t.submission}`
    // [what, who is the lowest role allowed, the request]
    const actions: [string, string, (c: ReturnType<typeof client>) => Promise<{ status: number }>][] = [
      ['see forms', 'viewer', (c) => c.get('/api/forms')],
      ['see a form', 'viewer', (c) => c.get(form)],
      ['see submissions', 'viewer', (c) => c.get(`${form}/submissions`)],
      ['export', 'viewer', (c) => c.get(`${form}/submissions.csv`)],
      ['see reports', 'viewer', (c) => c.get(`${form}/report`)],
      ['see the dashboard', 'viewer', (c) => c.get('/api/dashboard')],
      ['see members', 'viewer', (c) => c.get('/api/workspace/members')],
      ['set a status', 'reviewer', (c) => c.patch(sub, { status: 'in_review' })],
      ['add a note', 'reviewer', (c) => c.post(`${sub}/notes`, { body: 'Checked' })],
      ['edit answers', 'editor', (c) => c.patch(sub, { data: { name: 'Edited' } })],
      ['edit a form', 'editor', (c) => c.patch(form, { name: 'Survey' })],
      ['publish', 'editor', (c) => c.post(`${form}/publish`)],
      ['see webhooks', 'editor', (c) => c.get(`${form}/webhooks`)],
      ['create a form', 'editor', (c) => c.post('/api/forms', { name: 'Another' })],
      ['invite someone', 'admin', (c) => c.post('/api/workspace/invites', { email: `new-${Math.random().toString(36).slice(2)}@example.com`, role: 'viewer' })],
      ['rename the workspace', 'owner', (c) => c.patch('/api/workspace', { name: 'Team' })],
    ]
    const order = ['viewer', 'reviewer', 'editor', 'admin', 'owner']
    const who: Record<string, ReturnType<typeof client>> = { viewer: t.viewer, reviewer: t.reviewer, editor: t.editor, admin: t.admin, owner: t.owner }
    for (const [what, minimum, request] of actions) {
      for (const role of order) {
        const allowed = order.indexOf(role) >= order.indexOf(minimum)
        const { status } = await request(who[role])
        expect(status === 403, `${role} tries to ${what}: got ${status}`).toBe(!allowed)
        if (allowed) expect(status, `${role} should be able to ${what}`).toBeLessThan(300)
      }
    }
    // Deleting is checked last because it removes the things the other checks need.
    expect((await t.editor.del(`/api/forms/${t.formId}`)).status).toBe(403)
    expect((await t.viewer.del(sub)).status).toBe(403)
    expect((await t.editor.del(sub)).status).toBe(200)
    expect((await t.admin.del(`/api/forms/${t.formId}`)).status).toBe(200)
  })

  it('only lets people manage those below them', async () => {
    const t = await team()
    const role = async (userId: string) => (await t.owner.get('/api/workspace/members')).json.members.find((m: any) => m.id === userId).role

    // An admin can change and remove editors and below, but not another admin or the owner.
    expect((await t.admin.patch(`/api/workspace/members/${t.editor.id}`, { role: 'reviewer' })).status).toBe(200)
    expect(await role(t.editor.id)).toBe('reviewer')
    expect((await t.admin.patch(`/api/workspace/members/${t.editor.id}`, { role: 'admin' })).status).toBe(422)
    expect((await t.admin.patch(`/api/workspace/members/${t.owner.id}`, { role: 'viewer' })).status).toBe(403)
    expect((await t.admin.del(`/api/workspace/members/${t.owner.id}`)).status).toBe(403)
    expect((await t.admin.patch(`/api/workspace/members/${t.admin.id}`, { role: 'owner' })).status).toBe(403)
    expect((await t.admin.post('/api/workspace/invites', { email: 'x@example.com', role: 'admin' })).status).toBe(422)
    expect((await t.editor.patch(`/api/workspace/members/${t.viewer.id}`, { role: 'reviewer' })).status).toBe(403)

    // The owner can make admins, but nobody can be made owner, and the owner cannot leave.
    expect((await t.owner.patch(`/api/workspace/members/${t.reviewer.id}`, { role: 'admin' })).status).toBe(200)
    expect((await t.owner.patch(`/api/workspace/members/${t.reviewer.id}`, { role: 'owner' })).status).toBe(422)
    expect((await t.owner.del(`/api/workspace/members/${t.owner.id}`)).status).toBe(403)
    expect((await t.owner.patch(`/api/workspace/members/nobody`, { role: 'viewer' })).status).toBe(404)
  })

  it('cuts off access as soon as someone is removed or leaves', async () => {
    const t = await team()
    const key = (await t.editor.post('/api/api-keys', { name: 'Script' })).json.key
    const auth = { authorization: `Bearer ${key}` }
    expect((await client().get('/api/forms', auth)).json.forms).toHaveLength(1)

    expect((await t.admin.del(`/api/workspace/members/${t.editor.id}`)).status).toBe(200)
    // The removed editor falls back to their own workspace, where the team's form does not exist.
    expect((await t.editor.get('/api/auth/me')).json.workspace).toMatchObject({ name: "Editor's workspace", role: 'owner' })
    expect((await t.editor.get(`/api/forms/${t.formId}`)).status).toBe(404)
    expect((await t.editor.get('/api/forms')).json.forms).toEqual([])
    expect((await client().get('/api/forms', auth)).status).toBe(401)

    // Anyone but the owner can leave by themselves.
    expect((await t.viewer.del(`/api/workspace/members/${t.viewer.id}`)).status).toBe(200)
    expect((await t.viewer.get(`/api/forms/${t.formId}`)).status).toBe(404)
    expect((await t.owner.get('/api/workspace/members')).json.members.map((m: any) => m.role).sort()).toEqual(['admin', 'owner', 'reviewer'])
  })

  it('limits an API key to one workspace and to reading', async () => {
    const t = await team()
    const key = (await t.admin.post('/api/api-keys', { name: 'Script' })).json.key
    const robot = client()
    const auth = { authorization: `Bearer ${key}` }
    expect((await robot.get(`/api/forms/${t.formId}/submissions`, auth)).status).toBe(200)
    // Even though the key belongs to an admin, it can only read.
    expect((await robot.get(`/api/forms/${t.formId}/webhooks`, auth)).status).toBe(403)
    expect((await robot.get('/api/workspace/members', auth)).status).toBe(403)

    // The key stays with the team workspace when its creator switches to their own.
    const own = (await t.admin.get('/api/auth/me')).json.workspaces.find((w: any) => w.role === 'owner')
    await t.admin.post('/api/workspaces/switch', { id: own.id })
    expect((await t.admin.get('/api/api-keys')).json.keys).toEqual([])
    expect((await robot.get('/api/forms', auth)).json.forms).toHaveLength(1)
  })

  it('shares lookups within a workspace but not across workspaces', async () => {
    const t = await team()
    await t.owner.patch(`/api/forms/${t.formId}`, { settings: { exposedFields: ['name'] } })
    const reader = { version: 1 as const, pages: [{ key: 'p', components: [
      { type: 'text', key: 'who' },
      { type: 'lookup', key: 'found', source: t.slug, matchField: 'name', matchValue: 'who', returnField: 'name' },
    ] }] }
    const query = { source: t.slug, where: { name: 'A' }, select: 'name', aggregate: 'first' }

    // A form made by a teammate in the same workspace can read it.
    const inside = (await t.editor.post('/api/forms', { name: 'Inside', schema: reader })).json.form
    await t.editor.post(`/api/forms/${inside.id}/publish`)
    expect((await client().post(`/api/public/forms/${inside.slug}/lookup`, query)).json).toEqual({ value: 'A' })

    // The same form in the editor's own workspace cannot.
    const own = (await t.editor.get('/api/auth/me')).json.workspaces.find((w: any) => w.role === 'owner')
    await t.editor.post('/api/workspaces/switch', { id: own.id })
    const outside = (await t.editor.post('/api/forms', { name: 'Outside', schema: reader })).json.form
    await t.editor.post(`/api/forms/${outside.id}/publish`)
    expect((await client().post(`/api/public/forms/${outside.slug}/lookup`, query)).json).toEqual({ value: null })
  })
})

// PostgreSQL support began after teams, so there is no older PostgreSQL database to upgrade.
describe.skipIf(POSTGRES)('upgrading an existing database', () => {
  it('moves each account and its forms into a workspace of its own', async () => {
    // Build a database as it was before teams existed, then open it with the current code.
    const { default: Database } = await import('better-sqlite3')
    const { mkdtempSync } = await import('node:fs')
    const { tmpdir } = await import('node:os')
    const { join: joinPath } = await import('node:path')
    const path = joinPath(mkdtempSync(joinPath(tmpdir(), 'formknit-')), 'old.sqlite')
    const fresh = await createDb(path)
    await fresh.close()
    const raw = new Database(path)
    // Undo the teams step by hand: drop its tables and columns, and mark it as not run.
    raw.exec(`DROP TABLE members; DROP TABLE invites; DROP TABLE workspaces; DROP INDEX forms_workspace;
      ALTER TABLE forms DROP COLUMN workspace_id; ALTER TABLE sessions DROP COLUMN workspace_id; ALTER TABLE api_keys DROP COLUMN workspace_id;
      DELETE FROM migrations WHERE version = 3;
      INSERT INTO users VALUES ('u1', 'old@example.com', 'Old User', 'scrypt$x', 1), ('u2', 'two@example.com', 'Two', 'scrypt$x', 2);
      INSERT INTO forms VALUES ('f1', 'u1', 'Old form', 'old-form', 'draft', '{"version":1,"pages":[]}', NULL, NULL, '{}', 1, 1);
      INSERT INTO api_keys VALUES ('k1', 'u1', 'Key', 'fk_abc', 1, NULL);`)
    raw.close()

    const upgraded = await createDb(path)
    const all = (sql: string) => (upgraded as any).$client.prepare(sql).all()
    expect(all('SELECT id, name FROM workspaces ORDER BY id')).toEqual([{ id: 'u1', name: "Old User's workspace" }, { id: 'u2', name: "Two's workspace" }])
    expect(all('SELECT workspace_id, user_id, role FROM members ORDER BY user_id')).toEqual([
      { workspace_id: 'u1', user_id: 'u1', role: 'owner' },
      { workspace_id: 'u2', user_id: 'u2', role: 'owner' },
    ])
    expect(all('SELECT workspace_id FROM forms')).toEqual([{ workspace_id: 'u1' }])
    expect(all('SELECT workspace_id FROM api_keys')).toEqual([{ workspace_id: 'u1' }])
    await upgraded.close()
  })
})

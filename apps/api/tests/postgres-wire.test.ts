import { form, number, text } from '@formknit/core'
import { describe, expect, it } from 'vitest'
import { createApp } from '../src/app'
import { createDb, POSTGRES } from '../src/db'

const ORIGIN = 'http://localhost:5175'

// The other tests reach the embedded PostgreSQL directly. This one goes through the network
// driver a real server needs, by putting the embedded database behind a socket.
describe.skipIf(!POSTGRES)('PostgreSQL over the network', () => {
  it('sets up the tables and serves the app through the pg driver', async () => {
    const { PGlite } = await import('@electric-sql/pglite')
    const { PGLiteSocketServer } = await import('@electric-sql/pglite-socket')
    const server = new PGLiteSocketServer({ db: await PGlite.create(), port: 0, host: '127.0.0.1' })
    await server.start()
    const db = await createDb(`postgres://postgres:postgres@${server.getServerConn()}/postgres?sslmode=disable`)
    try {
      const app = createApp({ db, webOrigins: [ORIGIN] })
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

      expect((await call('POST', '/api/auth/register', { name: 'Wire', email: 'wire@example.com', password: 'a long enough password' })).status).toBe(201)
      const schema = form('Wire', [text('name').required(), number('qty')])
      const created = await call('POST', '/api/forms', { name: 'Wire', schema })
      expect(created.status).toBe(201)
      expect((await call('POST', `/api/forms/${created.json.form.id}/publish`)).status).toBe(200)
      expect((await call('POST', `/api/public/forms/${created.json.form.slug}/submissions`, { name: 'Sita', qty: '3' })).status).toBe(201)
      const list = await call('GET', `/api/forms/${created.json.form.id}/submissions?q=SITA`)
      expect(list.json.total).toBe(1)
      expect(list.json.submissions[0].data).toEqual({ name: 'Sita', qty: 3 })
      expect(typeof list.json.submissions[0].createdAt).toBe('number')
      await app.idle()
    } finally {
      await db.close()
      await server.stop()
    }
  }, 120000)
})

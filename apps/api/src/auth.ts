import { and, eq, gt, lt } from 'drizzle-orm'
import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto'
import { sessions, users, type Db } from './db'

const SCRYPT = { N: 16384, r: 8, p: 1, keyLength: 64 }
export const SESSION_DAYS = 30
export const SESSION_COOKIE = 'fk_session'

const derive = (password: string, salt: Buffer, opts = SCRYPT) =>
  new Promise<Buffer>((resolve, reject) =>
    scrypt(password, salt, opts.keyLength, { N: opts.N, r: opts.r, p: opts.p }, (err, key) => (err ? reject(err) : resolve(key))),
  )

/** Stores the parameters with the hash, so they can be strengthened later without breaking old passwords. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const key = await derive(password, salt)
  return ['scrypt', SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString('base64'), key.toString('base64')].join('$')
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, N, r, p, salt, hash] = stored.split('$')
  if (scheme !== 'scrypt' || !salt || !hash) return false
  const expected = Buffer.from(hash, 'base64')
  const actual = await derive(password, Buffer.from(salt, 'base64'), { N: Number(N), r: Number(r), p: Number(p), keyLength: expected.length })
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

const tokenId = (token: string) => createHash('sha256').update(token).digest('hex')

/** Returns the token to put in the cookie. Only its hash is stored. */
export function createSession(db: Db, userId: string, now = Date.now()): string {
  const token = randomBytes(32).toString('base64url')
  db.insert(sessions).values({ id: tokenId(token), userId, createdAt: now, expiresAt: now + SESSION_DAYS * 86400000 }).run()
  // Tidy up while we are here; expired sessions are useless.
  db.delete(sessions).where(lt(sessions.expiresAt, now)).run()
  return token
}

export function findSessionUser(db: Db, token: string | undefined, now = Date.now()) {
  if (!token) return undefined
  return db
    .select({ id: users.id, email: users.email, name: users.name })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, tokenId(token)), gt(sessions.expiresAt, now)))
    .get()
}

export function deleteSession(db: Db, token: string | undefined) {
  if (token) db.delete(sessions).where(eq(sessions.id, tokenId(token))).run()
}

export const newId = () => randomUUID()

/** Allows `max` attempts per key in each window. Kept in memory, so it resets on restart and is per process. */
export function rateLimiter(max: number, windowMs: number) {
  const hits = new Map<string, { count: number; resetAt: number }>()
  return (key: string, now = Date.now()): boolean => {
    const entry = hits.get(key)
    if (!entry || entry.resetAt <= now) {
      if (hits.size > 10000) for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k)
      hits.set(key, { count: 1, resetAt: now + windowMs })
      return true
    }
    entry.count++
    return entry.count <= max
  }
}

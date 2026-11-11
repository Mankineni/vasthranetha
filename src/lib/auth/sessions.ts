import { createHash, randomBytes } from 'node:crypto'
import { and, eq, gt, lt } from 'drizzle-orm'
import type { Db } from '@/db/client'
import { loginAttempts, sessions, users } from '@/db/schema'
import { hashPassword, verifyPassword } from './password'

export const SESSION_COOKIE = 'bq_session'
export const SESSION_TTL_MS = 90 * 24 * 60 * 60 * 1000
export const LOCKOUT_FAILURES = 5
export const LOCKOUT_WINDOW_MS = 15 * 60 * 1000
const MIN_PASSWORD = 10

// Compared against when the login does not exist, so a wrong login takes as
// long as a wrong password and does not reveal which logins are real.
let dummyHash: Promise<string> | null = null
const getDummyHash = () => (dummyHash ??= hashPassword('dummy-password-for-timing'))

export function normaliseLogin(login: string): string {
  return login.trim().toLowerCase()
}

function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export async function createOwner(
  db: Db,
  input: { name: string; login: string; password: string },
): Promise<{ id: number }> {
  const login = normaliseLogin(input.login)
  if (!login) throw new Error('Enter a login (email or phone number).')
  if (!input.name.trim()) throw new Error('Enter a name.')
  if (input.password.length < MIN_PASSWORD) throw new Error(`Password must be at least ${MIN_PASSWORD} characters.`)
  if (db.select({ id: users.id }).from(users).where(eq(users.login, login)).get()) {
    throw new Error(`An owner with login ${login} already exists.`)
  }
  const passwordHash = await hashPassword(input.password)
  const row = db.insert(users).values({ name: input.name.trim(), login, passwordHash }).returning({ id: users.id }).get()
  return { id: row.id }
}

export async function signIn(
  db: Db,
  rawLogin: string,
  password: string,
  now: number,
): Promise<{ ok: true; token: string; expiresAt: number } | { ok: false; reason: 'invalid' | 'locked' }> {
  const login = normaliseLogin(rawLogin)
  const since = now - LOCKOUT_WINDOW_MS
  const failures = db
    .select({ id: loginAttempts.id })
    .from(loginAttempts)
    .where(and(eq(loginAttempts.login, login), gt(loginAttempts.at, since)))
    .all().length
  if (failures >= LOCKOUT_FAILURES) return { ok: false, reason: 'locked' }

  const user = login ? db.select().from(users).where(eq(users.login, login)).get() : undefined
  const valid = user ? await verifyPassword(user.passwordHash, password) : await verifyPassword(await getDummyHash(), `x${password}`)
  if (!user || !valid) {
    db.insert(loginAttempts).values({ login, at: now }).run()
    // Old attempts are no longer needed for the lockout window.
    db.delete(loginAttempts).where(lt(loginAttempts.at, now - 24 * 60 * 60 * 1000)).run()
    return { ok: false, reason: 'invalid' }
  }

  db.delete(loginAttempts).where(eq(loginAttempts.login, login)).run()
  const token = randomBytes(32).toString('base64url')
  const expiresAt = now + SESSION_TTL_MS
  db.insert(sessions).values({ tokenHash: tokenHash(token), userId: user.id, expiresAt }).run()
  db.delete(sessions).where(lt(sessions.expiresAt, now)).run()
  return { ok: true, token, expiresAt }
}

export function getSessionUser(db: Db, token: string | undefined, now: number): { id: number; name: string } | null {
  if (!token) return null
  const row = db
    .select({ id: users.id, name: users.name, expiresAt: sessions.expiresAt })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.tokenHash, tokenHash(token)))
    .get()
  if (!row) return null
  if (row.expiresAt <= now) {
    db.delete(sessions).where(eq(sessions.tokenHash, tokenHash(token))).run()
    return null
  }
  return { id: row.id, name: row.name }
}

export function signOut(db: Db, token: string): void {
  db.delete(sessions).where(eq(sessions.tokenHash, tokenHash(token))).run()
}

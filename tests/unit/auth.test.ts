import { createTestDb } from '../helpers/db'
import { sessions, users } from '@/db/schema'
import { hashPassword, verifyPassword } from '@/lib/auth/password'
import {
  createOwner,
  getSessionUser,
  LOCKOUT_FAILURES,
  resetPassword,
  LOCKOUT_WINDOW_MS,
  SESSION_COOKIE,
  SESSION_TTL_MS,
  signIn,
  signOut,
} from '@/lib/auth/sessions'

const DAY = 86_400_000
const NOW = 1000 * DAY
const PASSWORD = 'correct-horse-battery'

async function setup() {
  const db = createTestDb()
  const owner = await createOwner(db, { name: 'Asha', login: ' Asha@Example.com ', password: PASSWORD })
  return { db, owner }
}

test('constants match the spec', () => {
  expect(SESSION_COOKIE).toBe('bq_session')
  expect(SESSION_TTL_MS).toBe(90 * DAY)
  expect(LOCKOUT_FAILURES).toBe(5)
  expect(LOCKOUT_WINDOW_MS).toBe(15 * 60_000)
})

test('passwords are hashed and verified; an invalid stored hash never verifies', async () => {
  const hash = await hashPassword(PASSWORD)
  expect(hash).not.toContain(PASSWORD)
  expect(await verifyPassword(hash, PASSWORD)).toBe(true)
  expect(await verifyPassword(hash, 'wrong-password')).toBe(false)
  expect(await verifyPassword('!', PASSWORD)).toBe(false)
})

test('the right password signs in, case-insensitively on the login, for 90 days', async () => {
  const { db, owner } = await setup()
  const r = await signIn(db, 'asha@example.COM', PASSWORD, NOW)
  if (!r.ok) throw new Error('expected sign-in')
  expect(r.token.length).toBeGreaterThanOrEqual(40)
  expect(r.expiresAt).toBe(NOW + 90 * DAY)
  expect(getSessionUser(db, r.token, NOW)).toEqual({ id: owner.id, name: 'Asha' })
})

test('wrong password and unknown login both say invalid', async () => {
  const { db } = await setup()
  expect(await signIn(db, 'asha@example.com', 'nope-nope-nope', NOW)).toEqual({ ok: false, reason: 'invalid' })
  expect(await signIn(db, 'nobody@example.com', PASSWORD, NOW)).toEqual({ ok: false, reason: 'invalid' })
})

test('after 5 failures the 6th attempt is locked even with the right password, then unlocks', async () => {
  const { db } = await setup()
  for (let i = 0; i < 5; i++) await signIn(db, 'asha@example.com', 'wrong-guess', NOW + i)
  expect(await signIn(db, 'asha@example.com', PASSWORD, NOW + 10)).toEqual({ ok: false, reason: 'locked' })
  const later = await signIn(db, 'asha@example.com', PASSWORD, NOW + 4 + 15 * 60_000 + 1)
  expect(later.ok).toBe(true)
})

test("one login's failures do not lock another, and another's success does not unlock it", async () => {
  const { db } = await setup()
  await createOwner(db, { name: 'Meera', login: 'meera@example.com', password: PASSWORD })
  for (let i = 0; i < 5; i++) await signIn(db, 'asha@example.com', 'wrong-guess', NOW)
  expect((await signIn(db, 'meera@example.com', PASSWORD, NOW)).ok).toBe(true)
  expect(await signIn(db, 'asha@example.com', PASSWORD, NOW)).toEqual({ ok: false, reason: 'locked' })
})

test('a successful sign-in clears that login’s own earlier failures', async () => {
  const { db } = await setup()
  for (let i = 0; i < 4; i++) await signIn(db, 'asha@example.com', 'wrong-guess', NOW)
  expect((await signIn(db, 'asha@example.com', PASSWORD, NOW)).ok).toBe(true)
  for (let i = 0; i < 4; i++) await signIn(db, 'asha@example.com', 'wrong-guess', NOW)
  expect((await signIn(db, 'asha@example.com', PASSWORD, NOW)).ok).toBe(true)
})

test('a session is valid at 89 days and gone at 91; sign-out ends it', async () => {
  const { db } = await setup()
  const r = await signIn(db, 'asha@example.com', PASSWORD, NOW)
  if (!r.ok) throw new Error('expected sign-in')
  expect(getSessionUser(db, r.token, NOW + 89 * DAY)).not.toBeNull()
  expect(getSessionUser(db, r.token, NOW + 91 * DAY)).toBeNull()

  const r2 = await signIn(db, 'asha@example.com', PASSWORD, NOW)
  if (!r2.ok) throw new Error('expected sign-in')
  signOut(db, r2.token)
  expect(getSessionUser(db, r2.token, NOW)).toBeNull()
  expect(getSessionUser(db, undefined, NOW)).toBeNull()
  expect(getSessionUser(db, 'not-a-real-token', NOW)).toBeNull()
})

test('the database never stores the raw session token', async () => {
  const { db } = await setup()
  const r = await signIn(db, 'asha@example.com', PASSWORD, NOW)
  if (!r.ok) throw new Error('expected sign-in')
  const rows = db.select().from(sessions).all()
  expect(rows).toHaveLength(1)
  expect(JSON.stringify(rows)).not.toContain(r.token)
})

test('a phone-number login works however the number is typed', async () => {
  const db = createTestDb()
  await createOwner(db, { name: 'Meera', login: '+91 98765 43210', password: PASSWORD })
  for (const typed of ['9876543210', '098765 43210', '919876543210', '+91-98765-43210']) {
    expect((await signIn(db, typed, PASSWORD, NOW)).ok, typed).toBe(true)
  }
  await expect(createOwner(db, { name: 'Dup', login: '9876543210', password: PASSWORD })).rejects.toThrow(/exists/)
})

test('an owner saved with an older, as-typed phone login can still sign in and be reset', async () => {
  const db = createTestDb()
  // Before phone logins were normalised, the login was stored trimmed and lower-cased only.
  db.insert(users).values({ name: 'Old', login: '+91 98765 43210', passwordHash: await hashPassword(PASSWORD) }).run()
  expect((await signIn(db, '9876543210', PASSWORD, NOW)).ok).toBe(true)
  expect((await signIn(db, '+91 98765 43210', PASSWORD, NOW)).ok).toBe(true)
  await resetPassword(db, '098765 43210', 'another-long-password')
  expect((await signIn(db, '9876543210', 'another-long-password', NOW)).ok).toBe(true)
})

test('resetPassword sets a new password and signs the owner out everywhere', async () => {
  const { db } = await setup()
  const before = await signIn(db, 'asha@example.com', PASSWORD, NOW)
  if (!before.ok) throw new Error('expected sign-in')
  await resetPassword(db, 'ASHA@example.com', 'a-brand-new-password')
  expect(getSessionUser(db, before.token, NOW)).toBeNull()
  expect(await signIn(db, 'asha@example.com', PASSWORD, NOW)).toEqual({ ok: false, reason: 'invalid' })
  expect((await signIn(db, 'asha@example.com', 'a-brand-new-password', NOW)).ok).toBe(true)
  await expect(resetPassword(db, 'nobody@example.com', 'a-brand-new-password')).rejects.toThrow(/No owner/)
  await expect(resetPassword(db, 'asha@example.com', 'short')).rejects.toThrow(/10 characters/)
})

test('createOwner rejects duplicates and short passwords', async () => {
  const { db } = await setup()
  await expect(createOwner(db, { name: 'X', login: 'ASHA@example.com', password: PASSWORD })).rejects.toThrow(/exists/)
  await expect(createOwner(db, { name: 'Y', login: 'y@example.com', password: 'short' })).rejects.toThrow(/10 characters/)
  await expect(createOwner(db, { name: 'Z', login: '  ', password: PASSWORD })).rejects.toThrow(/login/i)
})

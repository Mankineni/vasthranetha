import { createTestDb } from '../helpers/db'
import { getSettings, updateSettings } from '@/lib/settings/settings'
import { getPage, PAGE_SLUGS, savePage } from '@/lib/settings/pages'

test('defaults are returned from an empty database', () => {
  expect(getSettings(createTestDb())).toEqual({
    brandName: 'Boutique',
    tagline: '',
    logo: null,
    banner: null,
    whatsappNumber: null,
    soldVisibleDays: 7,
    customerPhotos: [],
  })
})

test('a patch changes only the given keys', () => {
  const db = createTestDb()
  expect(updateSettings(db, { brandName: 'Sari Sutra', tagline: 'Handpicked' })).toEqual({ ok: true })
  expect(updateSettings(db, { tagline: 'New line' })).toEqual({ ok: true })
  const s = getSettings(db)
  expect(s.brandName).toBe('Sari Sutra')
  expect(s.tagline).toBe('New line')
  expect(s.soldVisibleDays).toBe(7)
})

test('whatsapp number is stored normalised', () => {
  const db = createTestDb()
  updateSettings(db, { whatsappNumber: '+91 98765 43210' })
  expect(getSettings(db).whatsappNumber).toBe('919876543210')
})

test('an invalid whatsapp number is rejected and nothing is stored', () => {
  const db = createTestDb()
  const r = updateSettings(db, { brandName: 'Changed', whatsappNumber: '12345' })
  expect(r.ok).toBe(false)
  expect(getSettings(db).whatsappNumber).toBeNull()
  expect(getSettings(db).brandName).toBe('Boutique')
})

test('the whatsapp number can be cleared', () => {
  const db = createTestDb()
  updateSettings(db, { whatsappNumber: '9876543210' })
  expect(updateSettings(db, { whatsappNumber: null })).toEqual({ ok: true })
  expect(getSettings(db).whatsappNumber).toBeNull()
})

test.each([-1, 91, 2.5])('soldVisibleDays %s is rejected', (days) => {
  expect(updateSettings(createTestDb(), { soldVisibleDays: days }).ok).toBe(false)
})

test('soldVisibleDays 0 and 90 are accepted', () => {
  const db = createTestDb()
  expect(updateSettings(db, { soldVisibleDays: 0 }).ok).toBe(true)
  expect(updateSettings(db, { soldVisibleDays: 90 }).ok).toBe(true)
})

test('pages: unsaved slug is null, saved page round-trips, unknown slug throws', () => {
  const db = createTestDb()
  expect(PAGE_SLUGS).toEqual(['about', 'how-to-order', 'shipping-returns', 'contact'])
  expect(getPage(db, 'about')).toBeNull()
  savePage(db, 'about', { title: 'About us', body: 'We are two friends.\n\nWe love sarees.' })
  savePage(db, 'about', { title: 'About us', body: 'Updated' })
  expect(getPage(db, 'about')).toEqual({ slug: 'about', title: 'About us', body: 'Updated' })
  // @ts-expect-error unknown slug
  expect(() => savePage(db, 'privacy', { title: 'x', body: 'y' })).toThrow()
})

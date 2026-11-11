import { createTestDb } from '../helpers/db'
import { makeCategories } from '../helpers/fixtures'
import { nextCode, parseProductPath, productPath, slugify } from '@/lib/catalogue/codes'

test.each([
  ['Maroon Soft Silk!', 'maroon-soft-silk'],
  ['పట్టు చీర 🌸', ''],
  ['Red & Gold #1', 'red-gold-1'],
  ['  Café   Crème  ', 'cafe-creme'],
])('slugify(%s) → %s', (input, out) => {
  expect(slugify(input)).toBe(out)
})

test('slugify caps at 60 characters without a trailing dash', () => {
  const s = slugify('word '.repeat(30))
  expect(s.length).toBeLessThanOrEqual(60)
  expect(s.endsWith('-')).toBe(false)
})

test('productPath uses code and slug, or code alone', () => {
  expect(productPath({ code: 'S-1042', slug: 'maroon-soft-silk' })).toBe('/p/s-1042-maroon-soft-silk')
  expect(productPath({ code: 'S-1042', slug: '' })).toBe('/p/s-1042')
})

test.each(['s-1042-maroon', 'S-1042', 's-1042-'])('parseProductPath(%s) finds S-1042', (seg) => {
  expect(parseProductPath(seg)).toEqual({ code: 'S-1042' })
})

test.each(['hello', 's1042', '', 'abcd-1'])('parseProductPath(%s) → null', (seg) => {
  expect(parseProductPath(seg)).toBeNull()
})

test('nextCode uses the category prefix and one global counter from 1001', () => {
  const db = createTestDb()
  const { sarees, dresses } = makeCategories(db)
  expect(nextCode(db, sarees)).toBe('S-1001')
  expect(nextCode(db, dresses)).toBe('D-1002')
  expect(nextCode(db, sarees)).toBe('S-1003')
})

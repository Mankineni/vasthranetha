import { eq } from 'drizzle-orm'
import { createTestDb } from '../helpers/db'
import { makeCategories, makeInput, makeMediaRow, makeUser } from '../helpers/fixtures'
import { media, products } from '@/db/schema'
import {
  countByStatus,
  createProduct,
  deleteProduct,
  duplicateProduct,
  getAdminProduct,
  listAdminProducts,
  productIdsByCode,
  setStatus,
  updateProduct,
  validateProductInput,
} from '@/lib/catalogue/admin'
import { createFabric, createOccasion } from '@/lib/catalogue/taxonomy'

function setup() {
  const db = createTestDb()
  const cats = makeCategories(db)
  const user = makeUser(db)
  return { db, ...cats, user }
}

test('200 products across two categories get 200 distinct codes', () => {
  const { db, sarees, dresses, user } = setup()
  const codes = new Set<string>()
  for (let i = 0; i < 200; i++) {
    const p = createProduct(db, makeInput(i % 2 ? sarees : dresses), user, { publish: false, now: i })
    codes.add(p.code)
  }
  expect(codes.size).toBe(200)
})

test('the same submitToken twice returns the same product and leaves one row', () => {
  const { db, sarees, user } = setup()
  const input = makeInput(sarees, { mediaIds: [makeMediaRow(db)] })
  const a = createProduct(db, input, user, { publish: true, now: 1 })
  const b = createProduct(db, input, user, { publish: true, now: 2 })
  expect(b.id).toBe(a.id)
  expect(db.select().from(products).all()).toHaveLength(1)
})

describe('validateProductInput', () => {
  test('a valid draft with no photos has no errors', () => {
    const { sarees } = setup()
    expect(validateProductInput(makeInput(sarees), false)).toEqual([])
  })

  test.each([
    ['empty name', { name: '  ' }, 'Enter a name.'],
    ['zero price', { price: 0 }, 'Enter a price in whole rupees.'],
    ['fractional price', { price: 10.5 }, 'Enter a price in whole rupees.'],
    ['negative dealer price', { dealerPrice: -5 }, 'Dealer price must be a whole number of rupees.'],
  ])('%s is an error', (_label, overrides, message) => {
    const { sarees } = setup()
    expect(validateProductInput(makeInput(sarees, overrides), false)).toContain(message)
  })

  test('publishing with no photo is an error', () => {
    const { sarees } = setup()
    expect(validateProductInput(makeInput(sarees), true)).toContain('Add at least one photo.')
  })

  test('unknown category, too many photos and two videos are errors', () => {
    const { db, sarees, user } = setup()
    expect(() =>
      createProduct(db, makeInput(9999, { mediaIds: [makeMediaRow(db)] }), user, { publish: true, now: 1 }),
    ).toThrow(/category/i)
    const photos = Array.from({ length: 13 }, () => makeMediaRow(db))
    expect(() => createProduct(db, makeInput(sarees, { mediaIds: photos }), user, { publish: true, now: 1 })).toThrow(
      /12 photos/,
    )
    const videos = [makeMediaRow(db), makeMediaRow(db, 'video'), makeMediaRow(db, 'video')]
    expect(() => createProduct(db, makeInput(sarees, { mediaIds: videos }), user, { publish: true, now: 1 })).toThrow(
      /one video/,
    )
  })
})

test('publish sets available and publishedAt; draft leaves them unset', () => {
  const { db, sarees, user } = setup()
  const pub = createProduct(db, makeInput(sarees, { mediaIds: [makeMediaRow(db)] }), user, { publish: true, now: 100 })
  expect(pub).toMatchObject({ status: 'available', publishedAt: 100, createdBy: user, updatedBy: user })
  const draft = createProduct(db, makeInput(sarees), user, { publish: false, now: 100 })
  expect(draft).toMatchObject({ status: 'draft', publishedAt: null })
})

test('media are attached in order and detached when no longer listed', () => {
  const { db, sarees, user } = setup()
  const [m1, m2, m3] = [makeMediaRow(db), makeMediaRow(db), makeMediaRow(db)]
  const p = createProduct(db, makeInput(sarees, { mediaIds: [m2, m1, m3] }), user, { publish: true, now: 1 })
  expect(p.media.map((m) => m.id)).toEqual([m2, m1, m3])
  const row = db.select().from(media).where(eq(media.id, m2)).get()!
  expect(row).toMatchObject({ productId: p.id, position: 0, batchId: null })

  const updated = updateProduct(db, p.id, { ...makeInput(sarees), mediaIds: [m3, m2] }, user, 2)
  expect(updated.media.map((m) => m.id)).toEqual([m3, m2])
  expect(db.select().from(media).where(eq(media.id, m1)).get()!.productId).toBeNull()
})

test('setStatus records soldAt and the first publish time', () => {
  const { db, sarees, user } = setup()
  const p = createProduct(db, makeInput(sarees, { mediaIds: [makeMediaRow(db)] }), user, { publish: false, now: 1 })
  setStatus(db, p.id, 'available', user, 50)
  expect(getAdminProduct(db, p.id)).toMatchObject({ status: 'available', publishedAt: 50 })
  setStatus(db, p.id, 'sold', user, 60)
  expect(getAdminProduct(db, p.id)).toMatchObject({ status: 'sold', soldAt: 60 })
  setStatus(db, p.id, 'available', user, 70)
  expect(getAdminProduct(db, p.id)).toMatchObject({ status: 'available', soldAt: null, publishedAt: 50 })
})

test('updateProduct keeps the code, changes the slug and records the editor', () => {
  const { db, sarees, user } = setup()
  const other = makeUser(db, 'Friend')
  const p = createProduct(db, makeInput(sarees), user, { publish: false, now: 1 })
  const u = updateProduct(db, p.id, makeInput(sarees, { name: 'Teal Cotton' }), other, 2)
  expect(u.code).toBe(p.code)
  expect(u.slug).toBe('teal-cotton')
  expect(u.updatedBy).toBe(other)
  expect(u.createdBy).toBe(user)
})

test('all fields round-trip, including occasions, sizes and dealer fields', () => {
  const { db, dresses, user } = setup()
  const silk = createFabric(db, 'Soft silk')
  const party = createOccasion(db, 'Party')
  if (!silk.ok || !party.ok) throw new Error('setup')
  const input = makeInput(dresses, {
    fabricId: silk.id,
    occasionIds: [party.id],
    sizes: ['S', 'M'],
    colours: ['Teal'],
    blousePiece: true,
    dealerName: 'Ravi',
    dealerCode: 'RV-9',
    dealerPrice: 1200,
    notes: 'ask for HD photos',
  })
  const p = createProduct(db, input, user, { publish: false, now: 1 })
  const expected: Partial<typeof input> = { ...input }
  delete expected.submitToken
  delete expected.mediaIds
  expect(getAdminProduct(db, p.id)).toMatchObject(expected)
})

test('duplicateProduct copies fields but not code, media, status or token', () => {
  const { db, sarees, user } = setup()
  const p = createProduct(db, makeInput(sarees, { mediaIds: [makeMediaRow(db)], dealerPrice: 900 }), user, {
    publish: true,
    now: 1,
  })
  const d = duplicateProduct(db, p.id, user, 2)
  expect(d.code).not.toBe(p.code)
  expect(d).toMatchObject({ name: 'Maroon Soft Silk (copy)', status: 'draft', dealerPrice: 900, price: 1850 })
  expect(d.media).toEqual([])
  expect(d.submitToken).not.toBe(p.submitToken)
})

test('a draft without photos cannot be made available or sold', () => {
  const { db, sarees, user } = setup()
  const p = createProduct(db, makeInput(sarees), user, { publish: false, now: 1 })
  expect(() => setStatus(db, p.id, 'available', user, 2)).toThrow('Add at least one photo.')
  expect(() => setStatus(db, p.id, 'sold', user, 2)).toThrow('Add at least one photo.')
})

test('deleteProduct refuses while media are attached, then deletes', () => {
  const { db, sarees, user } = setup()
  const m = makeMediaRow(db)
  const p = createProduct(db, makeInput(sarees, { mediaIds: [m] }), user, { publish: true, now: 1 })
  expect(() => deleteProduct(db, p.id)).toThrow()
  db.delete(media).where(eq(media.id, m)).run()
  deleteProduct(db, p.id)
  expect(getAdminProduct(db, p.id)).toBeNull()
})

test('productIdsByCode maps codes to ids and skips unknown codes', () => {
  const { db, sarees, user } = setup()
  const a = createProduct(db, makeInput(sarees), user, { publish: false, now: 1 })
  expect(productIdsByCode(db, [a.code, 'S-999999'])).toEqual(new Map([[a.code, a.id]]))
  expect(productIdsByCode(db, [])).toEqual(new Map())
})

test('listAdminProducts returns at most `limit` rows, newest first, and counts every status', () => {
  const { db, sarees, user } = setup()
  for (let i = 0; i < 5; i++) createProduct(db, makeInput(sarees, { name: `P${i}` }), user, { publish: false, now: i })
  expect(listAdminProducts(db, { limit: 2 }).map((p) => p.name)).toEqual(['P4', 'P3'])
  expect(countByStatus(db)).toEqual({ all: 5, draft: 5, available: 0, sold: 0 })
})

test('listAdminProducts searches by code or name and filters by status, newest first', () => {
  const { db, sarees, user } = setup()
  const a = createProduct(db, makeInput(sarees, { name: 'Red Silk' }), user, { publish: false, now: 1 })
  const b = createProduct(db, makeInput(sarees, { name: 'Blue Cotton', mediaIds: [makeMediaRow(db)] }), user, {
    publish: true,
    now: 2,
  })
  setStatus(db, b.id, 'sold', user, 3)
  expect(listAdminProducts(db, {}).map((p) => p.id)).toEqual([b.id, a.id])
  expect(listAdminProducts(db, { q: a.code.toLowerCase() }).map((p) => p.id)).toEqual([a.id])
  expect(listAdminProducts(db, { q: 'SILK' }).map((p) => p.id)).toEqual([a.id])
  expect(listAdminProducts(db, { status: 'sold' }).map((p) => p.id)).toEqual([b.id])
})

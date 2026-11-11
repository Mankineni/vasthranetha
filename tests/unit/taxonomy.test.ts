import { createTestDb } from '../helpers/db'
import { makeCategories, makeInput, makeUser } from '../helpers/fixtures'
import {
  createCategory,
  createFabric,
  createOccasion,
  deleteCategory,
  deleteFabric,
  deleteOccasion,
  listCategories,
  listFabrics,
  listOccasions,
  listPriceBands,
  savePriceBands,
  updateCategory,
} from '@/lib/catalogue/taxonomy'
import { createProduct } from '@/lib/catalogue/admin'

test('categories are created with slug and upper-case prefix, listed by position then name', () => {
  const db = createTestDb()
  createCategory(db, { name: 'Sarees', codePrefix: 's' })
  createCategory(db, { name: 'Dresses', codePrefix: 'D' })
  const rows = listCategories(db)
  expect(rows.map((c) => c.name)).toEqual(['Dresses', 'Sarees'])
  expect(rows.find((c) => c.name === 'Sarees')).toMatchObject({ slug: 'sarees', codePrefix: 'S' })
  const sarees = rows.find((c) => c.name === 'Sarees')!
  updateCategory(db, sarees.id, { position: -1 })
  expect(listCategories(db)[0].name).toBe('Sarees')
})

test.each(['', '1', 'ABCD', 'S1'])('category prefix %s is rejected', (prefix) => {
  expect(createCategory(createTestDb(), { name: 'X', codePrefix: prefix }).ok).toBe(false)
})

test('duplicate category name is rejected', () => {
  const db = createTestDb()
  createCategory(db, { name: 'Sarees', codePrefix: 'S' })
  expect(createCategory(db, { name: 'sarees', codePrefix: 'T' }).ok).toBe(false)
})

test('a category in use cannot be deleted; an unused one can', () => {
  const db = createTestDb()
  const { sarees, dresses } = makeCategories(db)
  createProduct(db, makeInput(sarees), makeUser(db), { publish: false, now: 1 })
  expect(deleteCategory(db, sarees)).toEqual({ ok: false, error: 'in use' })
  expect(deleteCategory(db, dresses)).toEqual({ ok: true })
})

test('fabrics and occasions: create, list, delete when in use', () => {
  const db = createTestDb()
  const { sarees } = makeCategories(db)
  const silk = createFabric(db, 'Soft silk')
  const cotton = createFabric(db, 'Cotton')
  const wedding = createOccasion(db, 'Wedding')
  if (!silk.ok || !cotton.ok || !wedding.ok) throw new Error('setup')
  expect(listFabrics(db).map((f) => f.name)).toEqual(['Cotton', 'Soft silk'])
  expect(listFabrics(db)[1].slug).toBe('soft-silk')
  expect(createFabric(db, 'cotton').ok).toBe(false)

  createProduct(db, makeInput(sarees, { fabricId: silk.id, occasionIds: [wedding.id] }), makeUser(db), { publish: false, now: 1 })
  expect(deleteFabric(db, silk.id)).toEqual({ ok: false, error: 'in use' })
  expect(deleteOccasion(db, wedding.id)).toEqual({ ok: false, error: 'in use' })
  expect(deleteFabric(db, cotton.id)).toEqual({ ok: true })
  expect(listOccasions(db)).toHaveLength(1)
})

test('price bands are replaced as a whole and kept in the given order', () => {
  const db = createTestDb()
  savePriceBands(db, [
    { label: 'Under ₹999', min: 0, max: 999 },
    { label: '₹1,000 to ₹2,499', min: 1000, max: 2499 },
    { label: '₹2,500 and above', min: 2500, max: null },
  ])
  savePriceBands(db, [
    { label: 'Budget', min: 0, max: 1499 },
    { label: 'Premium', min: 1500, max: null },
  ])
  const bands = listPriceBands(db)
  expect(bands.map((b) => b.label)).toEqual(['Budget', 'Premium'])
  expect(bands[1].max).toBeNull()
})

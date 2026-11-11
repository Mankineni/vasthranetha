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

test('categories are created with slug and upper-case prefix, listed in the order they were added', () => {
  const db = createTestDb()
  createCategory(db, { name: 'Sarees', codePrefix: 's' })
  createCategory(db, { name: 'Dresses', codePrefix: 'D' })
  createCategory(db, { name: 'Accessories', codePrefix: 'A' })
  const rows = listCategories(db)
  expect(rows.map((c) => c.name)).toEqual(['Sarees', 'Dresses', 'Accessories'])
  expect(rows[0]).toMatchObject({ slug: 'sarees', codePrefix: 'S' })
  const accessories = rows[2]
  updateCategory(db, accessories.id, { position: -1 })
  expect(listCategories(db)[0].name).toBe('Accessories')
})

test('renaming a category keeps its address, so shared /c/ links keep working', () => {
  const db = createTestDb()
  const r = createCategory(db, { name: 'Sarees', codePrefix: 'S' })
  if (!r.ok) throw new Error('setup')
  expect(updateCategory(db, r.id, { name: 'Silk Sarees' })).toEqual({ ok: true })
  expect(listCategories(db)[0]).toMatchObject({ name: 'Silk Sarees', slug: 'sarees' })
})

test('a rename may not take another category’s name', () => {
  const db = createTestDb()
  const a = createCategory(db, { name: 'Sarees', codePrefix: 'S' })
  createCategory(db, { name: 'Dresses', codePrefix: 'D' })
  if (!a.ok) throw new Error('setup')
  expect(updateCategory(db, a.id, { name: 'dresses' }).ok).toBe(false)
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

test('saving price bands keeps the ids of bands that stay, so shared /price links keep working', () => {
  const db = createTestDb()
  savePriceBands(db, [
    { label: 'Under ₹999', min: 0, max: 999 },
    { label: 'Mid', min: 1000, max: 2499 },
    { label: 'Top', min: 2500, max: null },
  ])
  const [under, mid, top] = listPriceBands(db)
  // Saved again unchanged: same ids.
  savePriceBands(db, listPriceBands(db).map(({ id, label, min, max }) => ({ id, label, min, max })))
  expect(listPriceBands(db).map((b) => b.id)).toEqual([under.id, mid.id, top.id])
  // Rename one, drop one, add one, reorder.
  savePriceBands(db, [
    { id: top.id, label: 'Premium', min: 2500, max: null },
    { id: under.id, label: 'Budget', min: 0, max: 999 },
    { label: 'Luxury', min: 10000, max: null },
  ])
  const after = listPriceBands(db)
  expect(after.map((b) => [b.id === top.id, b.id === under.id, b.label])).toEqual([
    [true, false, 'Premium'],
    [false, true, 'Budget'],
    [false, false, 'Luxury'],
  ])
  expect(after.some((b) => b.id === mid.id)).toBe(false)
})

test('an id that is not a stored band is treated as a new band', () => {
  const db = createTestDb()
  savePriceBands(db, [{ id: 9999, label: 'Odd', min: 0, max: 10 }])
  expect(listPriceBands(db).map((b) => b.label)).toEqual(['Odd'])
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

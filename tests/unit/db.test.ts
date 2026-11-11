import { eq } from 'drizzle-orm'
import { createTestDb } from '../helpers/db'
import { categories, events, occasions, productOccasions, products, users } from '@/db/schema'

function seedBasics() {
  const db = createTestDb()
  const [cat] = db.insert(categories).values({ name: 'Sarees', slug: 'sarees', codePrefix: 'S', position: 0 }).returning().all()
  const [user] = db.insert(users).values({ name: 'Owner', login: 'owner@test.local', passwordHash: 'x' }).returning().all()
  const now = Date.now()
  const base = {
    slug: 'maroon-silk', name: 'Maroon Silk', price: 1850, categoryId: cat.id,
    createdBy: user.id, updatedBy: user.id, createdAt: now, updatedAt: now,
  }
  return { db, cat, user, base }
}

test('migrated database accepts a category and a product', () => {
  const { db, base } = seedBasics()
  db.insert(products).values({ ...base, code: 'S-1001' }).run()
  const rows = db.select().from(products).all()
  expect(rows).toHaveLength(1)
  expect(rows[0].status).toBe('draft')
  expect(rows[0].sizes).toEqual([])
})

test('two products cannot share a code', () => {
  const { db, base } = seedBasics()
  db.insert(products).values({ ...base, code: 'S-1001' }).run()
  expect(() => db.insert(products).values({ ...base, code: 'S-1001' }).run()).toThrow()
})

test('deleting a product removes its product_occasions and events rows', () => {
  const { db, base } = seedBasics()
  const [p] = db.insert(products).values({ ...base, code: 'S-1001' }).returning().all()
  const [occ] = db.insert(occasions).values({ name: 'Wedding', slug: 'wedding' }).returning().all()
  db.insert(productOccasions).values({ productId: p.id, occasionId: occ.id }).run()
  db.insert(events).values({ productId: p.id, type: 'view', day: '2026-11-11', count: 3 }).run()

  db.delete(products).where(eq(products.id, p.id)).run()

  expect(db.select().from(productOccasions).all()).toHaveLength(0)
  expect(db.select().from(events).all()).toHaveLength(0)
})

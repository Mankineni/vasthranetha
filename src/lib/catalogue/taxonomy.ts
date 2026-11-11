import { asc, eq, sql } from 'drizzle-orm'
import type { Db } from '@/db/client'
import { categories, fabrics, occasions, priceBands, productOccasions, products } from '@/db/schema'
import { slugify } from './codes'

export type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string }

export type Category = typeof categories.$inferSelect
export type NamedItem = { id: number; name: string; slug: string }
export type PriceBand = typeof priceBands.$inferSelect

function nameError(name: string): string | null {
  if (!name.trim()) return 'Enter a name.'
  if (!slugify(name)) return 'Use at least one English letter or digit in the name.'
  return null
}

// --- categories ---

export function listCategories(db: Db): Category[] {
  return db.select().from(categories).orderBy(asc(categories.position), asc(categories.name)).all()
}

function prefixError(prefix: string): string | null {
  return /^[A-Za-z]{1,3}$/.test(prefix) ? null : 'Code prefix must be 1 to 3 letters.'
}

export function createCategory(db: Db, input: { name: string; codePrefix: string }): Result<{ id: number }> {
  const err = nameError(input.name) ?? prefixError(input.codePrefix)
  if (err) return { ok: false, error: err }
  const slug = slugify(input.name)
  if (db.select().from(categories).where(eq(categories.slug, slug)).get()) {
    return { ok: false, error: `${input.name.trim()} already exists.` }
  }
  const [row] = db
    .insert(categories)
    .values({ name: input.name.trim(), slug, codePrefix: input.codePrefix.toUpperCase(), position: 0 })
    .returning()
    .all()
  return { ok: true, id: row.id }
}

export function updateCategory(
  db: Db,
  id: number,
  patch: Partial<{ name: string; codePrefix: string; tileImage: string | null; position: number }>,
): Result {
  const set: Partial<Category> = {}
  if (patch.name !== undefined) {
    const err = nameError(patch.name)
    if (err) return { ok: false, error: err }
    const slug = slugify(patch.name)
    const clash = db.select().from(categories).where(eq(categories.slug, slug)).get()
    if (clash && clash.id !== id) return { ok: false, error: `${patch.name.trim()} already exists.` }
    set.name = patch.name.trim()
    set.slug = slug
  }
  if (patch.codePrefix !== undefined) {
    const err = prefixError(patch.codePrefix)
    if (err) return { ok: false, error: err }
    set.codePrefix = patch.codePrefix.toUpperCase()
  }
  if (patch.tileImage !== undefined) set.tileImage = patch.tileImage
  if (patch.position !== undefined) set.position = patch.position
  if (Object.keys(set).length) db.update(categories).set(set).where(eq(categories.id, id)).run()
  return { ok: true }
}

export function deleteCategory(db: Db, id: number): Result {
  const used = db.select({ n: sql<number>`count(*)` }).from(products).where(eq(products.categoryId, id)).get()!
  if (used.n > 0) return { ok: false, error: 'in use' }
  db.delete(categories).where(eq(categories.id, id)).run()
  return { ok: true }
}

// --- fabrics and occasions ---

type NamedTable = typeof fabrics | typeof occasions

function listNamed(db: Db, table: NamedTable): NamedItem[] {
  return db.select().from(table).orderBy(asc(table.name)).all()
}

function createNamed(db: Db, table: NamedTable, name: string): Result<{ id: number }> {
  const err = nameError(name)
  if (err) return { ok: false, error: err }
  const slug = slugify(name)
  if (db.select().from(table).where(eq(table.slug, slug)).get()) {
    return { ok: false, error: `${name.trim()} already exists.` }
  }
  const [row] = db.insert(table).values({ name: name.trim(), slug }).returning().all()
  return { ok: true, id: row.id }
}

export const listFabrics = (db: Db) => listNamed(db, fabrics)
export const createFabric = (db: Db, name: string) => createNamed(db, fabrics, name)
export function deleteFabric(db: Db, id: number): Result {
  const used = db.select({ n: sql<number>`count(*)` }).from(products).where(eq(products.fabricId, id)).get()!
  if (used.n > 0) return { ok: false, error: 'in use' }
  db.delete(fabrics).where(eq(fabrics.id, id)).run()
  return { ok: true }
}

export const listOccasions = (db: Db) => listNamed(db, occasions)
export const createOccasion = (db: Db, name: string) => createNamed(db, occasions, name)
export function deleteOccasion(db: Db, id: number): Result {
  const used = db
    .select({ n: sql<number>`count(*)` })
    .from(productOccasions)
    .where(eq(productOccasions.occasionId, id))
    .get()!
  if (used.n > 0) return { ok: false, error: 'in use' }
  db.delete(occasions).where(eq(occasions.id, id)).run()
  return { ok: true }
}

// --- price bands ---

export function listPriceBands(db: Db): PriceBand[] {
  return db.select().from(priceBands).orderBy(asc(priceBands.position), asc(priceBands.id)).all()
}

export function savePriceBands(db: Db, bands: { label: string; min: number; max: number | null }[]): Result {
  for (const b of bands) {
    if (!b.label.trim()) return { ok: false, error: 'Every price band needs a label.' }
    if (!Number.isInteger(b.min) || b.min < 0) return { ok: false, error: 'Minimum must be a whole number of rupees.' }
    if (b.max !== null && (!Number.isInteger(b.max) || b.max < b.min)) {
      return { ok: false, error: 'Maximum must be a whole number no lower than the minimum.' }
    }
  }
  db.transaction((tx) => {
    tx.delete(priceBands).run()
    bands.forEach((b, i) => tx.insert(priceBands).values({ ...b, label: b.label.trim(), position: i }).run())
  })
  return { ok: true }
}

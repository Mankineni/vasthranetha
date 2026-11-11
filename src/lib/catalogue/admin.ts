import { randomUUID } from 'node:crypto'
import { and, asc, desc, eq, inArray, or, sql } from 'drizzle-orm'
import type { Db, Tx } from '@/db/client'
import { categories, fabrics, media, occasions, productOccasions, products } from '@/db/schema'
import { nextCode, slugify } from './codes'
import {
  type AdminProduct,
  MAX_PHOTOS,
  MAX_VIDEOS,
  type MediaItem,
  ProductError,
  type ProductInput,
  type ProductStatus,
} from './types'

type ProductRow = typeof products.$inferSelect

/**
 * Checks the rules that need only the input itself. Rules that need the
 * database (category exists, media kinds and limits) are enforced by
 * createProduct/updateProduct, which throw ProductError.
 */
export function validateProductInput(input: ProductInput, publish: boolean): string[] {
  const errors: string[] = []
  if (!input.name.trim()) errors.push('Enter a name.')
  if (!Number.isInteger(input.price) || input.price <= 0) errors.push('Enter a price in whole rupees.')
  if (input.dealerPrice !== null && (!Number.isInteger(input.dealerPrice) || input.dealerPrice < 0)) {
    errors.push('Dealer price must be a whole number of rupees.')
  }
  if (publish && input.mediaIds.length === 0) errors.push('Add at least one photo.')
  return errors
}

function cleanList(values: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const v of values) {
    const t = v.trim()
    if (t && !seen.has(t.toLowerCase())) {
      seen.add(t.toLowerCase())
      out.push(t)
    }
  }
  return out
}

function columnsFrom(input: ProductInput) {
  return {
    name: input.name.trim(),
    slug: slugify(input.name),
    price: input.price,
    categoryId: input.categoryId,
    fabricId: input.fabricId,
    length: input.length.trim(),
    blousePiece: input.blousePiece,
    care: input.care.trim(),
    description: input.description.trim(),
    sizes: cleanList(input.sizes),
    colours: cleanList(input.colours),
    dealerName: input.dealerName.trim(),
    dealerCode: input.dealerCode.trim(),
    dealerPrice: input.dealerPrice,
    notes: input.notes.trim(),
  }
}

/**
 * The chosen category, fabric and occasions must still exist: the other owner may have
 * deleted one while this form was open. Runs before any write, so the owner gets a clear
 * message instead of a database constraint error.
 */
function checkTaxonomy(tx: Tx, input: ProductInput): void {
  if (!Number.isInteger(input.categoryId) || !tx.select().from(categories).where(eq(categories.id, input.categoryId)).get()) {
    throw new ProductError('The category you chose was removed. Please choose a category.')
  }
  if (input.fabricId !== null && !tx.select().from(fabrics).where(eq(fabrics.id, input.fabricId)).get()) {
    throw new ProductError('The fabric you chose was removed. Please choose again.')
  }
  const occasionIds = [...new Set(input.occasionIds)]
  if (occasionIds.length) {
    const found = tx.select({ id: occasions.id }).from(occasions).where(inArray(occasions.id, occasionIds)).all()
    if (found.length !== occasionIds.length) {
      throw new ProductError('An occasion you chose was removed. Please choose again.')
    }
  }
}

/** Media checks, then attaches media in the given order and detaches the rest. */
function checkAndAttachMedia(tx: Tx, productId: number, input: ProductInput, publish: boolean): void {
  const ids = [...new Set(input.mediaIds)]
  const rows = ids.length ? tx.select().from(media).where(inArray(media.id, ids)).all() : []
  if (rows.length !== ids.length) throw new ProductError('A photo is missing. Please upload it again.')
  if (rows.some((r) => r.productId !== null && r.productId !== productId)) {
    throw new ProductError('A photo belongs to another product.')
  }
  const photos = rows.filter((r) => r.kind === 'photo').length
  const videos = rows.length - photos
  if (photos > MAX_PHOTOS) throw new ProductError(`Use at most ${MAX_PHOTOS} photos.`)
  if (videos > MAX_VIDEOS) throw new ProductError('Use at most one video.')
  if (publish && photos === 0) throw new ProductError('Add at least one photo.')

  // Detach anything no longer listed; it becomes unattached and the purge removes it later.
  const now = Date.now()
  const current = tx.select({ id: media.id }).from(media).where(eq(media.productId, productId)).all()
  const dropped = current.map((r) => r.id).filter((id) => !ids.includes(id))
  if (dropped.length) {
    tx.update(media).set({ productId: null, batchId: null, createdAt: now }).where(inArray(media.id, dropped)).run()
  }
  ids.forEach((id, position) => {
    tx.update(media).set({ productId, position, batchId: null }).where(eq(media.id, id)).run()
  })
}

function setOccasions(tx: Tx, productId: number, occasionIds: number[]): void {
  tx.delete(productOccasions).where(eq(productOccasions.productId, productId)).run()
  for (const occasionId of new Set(occasionIds)) {
    tx.insert(productOccasions).values({ productId, occasionId }).run()
  }
}

function assertValid(input: ProductInput, publish: boolean): void {
  const errors = validateProductInput(input, publish)
  if (errors.length) throw new ProductError(errors.join(' '))
}

export function createProduct(
  db: Db,
  input: ProductInput,
  userId: number,
  opts: { publish: boolean; now: number },
): AdminProduct {
  const existing = db.select().from(products).where(eq(products.submitToken, input.submitToken)).get()
  if (existing) {
    // The same form sent again (a double tap, or a retry after a lost connection):
    // save its latest values onto the product it already created rather than drop them.
    assertValid(input, opts.publish || existing.status !== 'draft')
    updateProduct(db, existing.id, input, userId, opts.now)
    if (opts.publish && existing.status === 'draft') setStatus(db, existing.id, 'available', userId, opts.now)
    return getAdminProduct(db, existing.id)!
  }

  assertValid(input, opts.publish)
  const id = db.transaction((tx) => {
    checkTaxonomy(tx, input)
    const [row] = tx
      .insert(products)
      .values({
        ...columnsFrom(input),
        code: nextCode(tx, input.categoryId),
        status: opts.publish ? 'available' : 'draft',
        submitToken: input.submitToken,
        createdBy: userId,
        updatedBy: userId,
        publishedAt: opts.publish ? opts.now : null,
        createdAt: opts.now,
        updatedAt: opts.now,
      })
      .returning({ id: products.id })
      .all()
    checkAndAttachMedia(tx, row.id, input, opts.publish)
    setOccasions(tx, row.id, input.occasionIds)
    return row.id
  })
  return getAdminProduct(db, id)!
}

export function updateProduct(db: Db, id: number, input: ProductInput, userId: number, now: number): AdminProduct {
  const current = db.select().from(products).where(eq(products.id, id)).get()
  if (!current) throw new ProductError('This product no longer exists.')
  const live = current.status !== 'draft'
  assertValid(input, live)
  db.transaction((tx) => {
    checkTaxonomy(tx, input)
    tx.update(products)
      .set({ ...columnsFrom(input), updatedBy: userId, updatedAt: now })
      .where(eq(products.id, id))
      .run()
    checkAndAttachMedia(tx, id, input, live)
    setOccasions(tx, id, input.occasionIds)
  })
  return getAdminProduct(db, id)!
}

export function setStatus(db: Db, id: number, status: ProductStatus, userId: number, now: number): void {
  const current = db.select().from(products).where(eq(products.id, id)).get()
  if (!current) throw new ProductError('This product no longer exists.')
  if (status !== 'draft') {
    const photos = db
      .select({ n: sql<number>`count(*)` })
      .from(media)
      .where(and(eq(media.productId, id), eq(media.kind, 'photo')))
      .get()!
    if (photos.n === 0) throw new ProductError('Add at least one photo.')
  }
  db.update(products)
    .set({
      status,
      soldAt: status === 'sold' ? now : null,
      publishedAt: current.publishedAt ?? (status === 'draft' ? null : now),
      updatedBy: userId,
      updatedAt: now,
    })
    .where(eq(products.id, id))
    .run()
}

export function duplicateProduct(db: Db, id: number, userId: number, now: number): AdminProduct {
  const src = getAdminProduct(db, id)
  if (!src) throw new ProductError('This product no longer exists.')
  return createProduct(
    db,
    {
      name: `${src.name} (copy)`,
      price: src.price,
      categoryId: src.categoryId,
      fabricId: src.fabricId,
      occasionIds: src.occasionIds,
      length: src.length,
      blousePiece: src.blousePiece,
      care: src.care,
      description: src.description,
      sizes: src.sizes,
      colours: src.colours,
      dealerName: src.dealerName,
      dealerCode: src.dealerCode,
      dealerPrice: src.dealerPrice,
      notes: src.notes,
      mediaIds: [],
      submitToken: randomUUID(),
    },
    userId,
    { publish: false, now },
  )
}

/** Deletes the product row only. Its media must be removed first (see deleteProductAndFiles). */
export function deleteProduct(db: Db, id: number): void {
  const attached = db.select({ n: sql<number>`count(*)` }).from(media).where(eq(media.productId, id)).get()!
  if (attached.n > 0) throw new Error('Remove the product media before deleting the product.')
  db.delete(products).where(eq(products.id, id)).run()
}

function toMediaItem(r: typeof media.$inferSelect): MediaItem {
  return {
    id: r.id,
    kind: r.kind,
    originalPath: r.originalPath,
    width: r.width,
    height: r.height,
    variants: r.variants,
    previewPath: r.previewPath,
  }
}

function hydrate(db: Db, rows: ProductRow[]): AdminProduct[] {
  if (!rows.length) return []
  const ids = rows.map((r) => r.id)
  const mediaRows = db
    .select()
    .from(media)
    .where(inArray(media.productId, ids))
    .orderBy(asc(media.position), asc(media.id))
    .all()
  const occRows = db.select().from(productOccasions).where(inArray(productOccasions.productId, ids)).all()
  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    slug: r.slug,
    name: r.name,
    price: r.price,
    status: r.status,
    categoryId: r.categoryId,
    fabricId: r.fabricId,
    occasionIds: occRows.filter((o) => o.productId === r.id).map((o) => o.occasionId),
    length: r.length,
    blousePiece: r.blousePiece,
    care: r.care,
    description: r.description,
    sizes: r.sizes,
    colours: r.colours,
    dealerName: r.dealerName,
    dealerCode: r.dealerCode,
    dealerPrice: r.dealerPrice,
    notes: r.notes,
    submitToken: r.submitToken ?? '',
    createdBy: r.createdBy,
    updatedBy: r.updatedBy,
    publishedAt: r.publishedAt,
    soldAt: r.soldAt,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    media: mediaRows.filter((m) => m.productId === r.id).map(toMediaItem),
  }))
}

export function getAdminProduct(db: Db, id: number): AdminProduct | null {
  const row = db.select().from(products).where(eq(products.id, id)).get()
  return row ? hydrate(db, [row])[0] : null
}

export function productIdsByCode(db: Db, codes: string[]): Map<string, number> {
  if (!codes.length) return new Map()
  const rows = db.select({ id: products.id, code: products.code }).from(products).where(inArray(products.code, codes)).all()
  return new Map(rows.map((r) => [r.code, r.id]))
}

export function countByStatus(db: Db): Record<ProductStatus | 'all', number> {
  const rows = db.select({ status: products.status, n: sql<number>`count(*)` }).from(products).groupBy(products.status).all()
  const counts = { all: 0, draft: 0, available: 0, sold: 0 }
  for (const r of rows) {
    counts[r.status] = r.n
    counts.all += r.n
  }
  return counts
}

export function listAdminProducts(
  db: Db,
  f: { q?: string; status?: ProductStatus; limit?: number },
): AdminProduct[] {
  const conds = []
  const q = f.q?.trim()
  if (q) {
    const escaped = q.replace(/[\\%_]/g, (c) => `\\${c}`)
    conds.push(or(sql`${products.name} LIKE ${`%${escaped}%`} ESCAPE '\\'`, eq(products.code, q.toUpperCase())))
  }
  if (f.status) conds.push(eq(products.status, f.status))
  const rows = db
    .select()
    .from(products)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(products.createdAt), desc(products.id))
    .limit(f.limit ?? -1)
    .all()
  return hydrate(db, rows)
}

// Re-exported so callers do not need a second import for the error type.
export { ProductError }

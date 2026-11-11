// Customer-side reads. Columns are always selected explicitly: dealer
// fields (dealerName, dealerCode, dealerPrice, notes) must never be read here.
import { and, asc, desc, eq, exists, gt, gte, inArray, lte, ne, or, sql, type SQL } from 'drizzle-orm'
import type { Db } from '@/db/client'
import { categories, fabrics, media, occasions, priceBands, productOccasions, products } from '@/db/schema'
import { getSettings } from '@/lib/settings/settings'
import { normaliseCodeQuery, productPath } from './codes'
import type { MediaItem } from './types'

const DAY_MS = 86_400_000
const DEFAULT_LIMIT = 24
const MAX_LIMIT = 48

/** A photo as the public sees it: processed versions only, never the original file. */
export type PublicPhoto = Omit<MediaItem, 'originalPath'>
export type PublicVideo = { id: number; path: string }

export type PublicCard = {
  code: string
  path: string
  name: string
  price: number
  sold: boolean
  cover: PublicPhoto | null
}

export type PublicProduct = PublicCard & {
  category: { name: string; slug: string }
  fabric: { name: string; slug: string } | null
  occasions: { name: string; slug: string }[]
  length: string
  blousePiece: boolean | null
  care: string
  description: string
  sizes: string[]
  colours: string[]
  photos: PublicPhoto[]
  video: PublicVideo | null
  publishedAt: number
}

export type ListQuery = {
  categorySlug?: string
  fabricSlug?: string
  occasionSlug?: string
  priceBandId?: number
  q?: string
  sort?: 'newest' | 'price-asc' | 'price-desc'
  offset?: number
  limit?: number
  now: number
}

const cardColumns = {
  id: products.id,
  code: products.code,
  slug: products.slug,
  name: products.name,
  price: products.price,
  status: products.status,
  publishedAt: products.publishedAt,
}
type CardRow = { id: number; code: string; slug: string; name: string; price: number; status: string }

/** Available products, plus sold ones still inside the sold-visibility window. */
function listedCondition(db: Db, now: number): SQL {
  const days = getSettings(db).soldVisibleDays
  return or(
    eq(products.status, 'available'),
    and(eq(products.status, 'sold'), gt(products.soldAt, now - days * DAY_MS)),
  )!
}

function toPhoto(r: typeof media.$inferSelect): PublicPhoto {
  return { id: r.id, kind: r.kind, width: r.width, height: r.height, variants: r.variants, previewPath: r.previewPath }
}

function coversFor(db: Db, ids: number[]): Map<number, PublicPhoto> {
  const covers = new Map<number, PublicPhoto>()
  if (!ids.length) return covers
  const rows = db
    .select()
    .from(media)
    .where(and(inArray(media.productId, ids), eq(media.kind, 'photo')))
    .orderBy(asc(media.position), asc(media.id))
    .all()
  for (const r of rows) if (r.productId !== null && !covers.has(r.productId)) covers.set(r.productId, toPhoto(r))
  return covers
}

function toCards(db: Db, rows: CardRow[]): PublicCard[] {
  const covers = coversFor(
    db,
    rows.map((r) => r.id),
  )
  return rows.map((r) => ({
    code: r.code,
    path: productPath(r),
    name: r.name,
    price: r.price,
    sold: r.status === 'sold',
    cover: covers.get(r.id) ?? null,
  }))
}

function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (c) => `\\${c}`)
}

export function listPublicProducts(db: Db, query: ListQuery): { items: PublicCard[]; total: number } {
  const conds: SQL[] = [listedCondition(db, query.now)]

  if (query.categorySlug) {
    const cat = db.select({ id: categories.id }).from(categories).where(eq(categories.slug, query.categorySlug)).get()
    if (!cat) return { items: [], total: 0 }
    conds.push(eq(products.categoryId, cat.id))
  }
  if (query.fabricSlug) {
    const fab = db.select({ id: fabrics.id }).from(fabrics).where(eq(fabrics.slug, query.fabricSlug)).get()
    if (!fab) return { items: [], total: 0 }
    conds.push(eq(products.fabricId, fab.id))
  }
  if (query.occasionSlug) {
    const occ = db.select({ id: occasions.id }).from(occasions).where(eq(occasions.slug, query.occasionSlug)).get()
    if (!occ) return { items: [], total: 0 }
    conds.push(
      exists(
        db
          .select({ x: sql`1` })
          .from(productOccasions)
          .where(and(eq(productOccasions.productId, products.id), eq(productOccasions.occasionId, occ.id))),
      ),
    )
  }
  if (query.priceBandId !== undefined) {
    const band = db.select().from(priceBands).where(eq(priceBands.id, query.priceBandId)).get()
    if (!band) return { items: [], total: 0 }
    conds.push(gte(products.price, band.min))
    if (band.max !== null) conds.push(lte(products.price, band.max))
  }
  const q = query.q?.trim()
  if (q) {
    conds.push(
      or(sql`${products.name} LIKE ${`%${escapeLike(q)}%`} ESCAPE '\\'`, eq(products.code, normaliseCodeQuery(q) ?? q.toUpperCase()))!,
    )
  }

  const where = and(...conds)
  const newest = [desc(products.publishedAt), desc(products.id)]
  const order =
    query.sort === 'price-asc'
      ? [asc(products.price), ...newest]
      : query.sort === 'price-desc'
        ? [desc(products.price), ...newest]
        : newest
  const limit = Math.min(Math.max(1, query.limit ?? DEFAULT_LIMIT), MAX_LIMIT)
  const offset = Math.max(0, query.offset ?? 0)

  const rows = db
    .select(cardColumns)
    .from(products)
    .where(where)
    .orderBy(...order)
    .limit(limit)
    .offset(offset)
    .all()
  const total = db.select({ n: sql<number>`count(*)` }).from(products).where(where).get()!.n
  return { items: toCards(db, rows), total }
}

/** Any published product by code, sold or not, however long ago; drafts are not found. */
export function getPublicProduct(db: Db, code: string): PublicProduct | null {
  const row = db
    .select({
      ...cardColumns,
      categoryId: products.categoryId,
      fabricId: products.fabricId,
      length: products.length,
      blousePiece: products.blousePiece,
      care: products.care,
      description: products.description,
      sizes: products.sizes,
      colours: products.colours,
    })
    .from(products)
    .where(and(eq(products.code, code.toUpperCase()), ne(products.status, 'draft')))
    .get()
  if (!row) return null

  const category = db
    .select({ name: categories.name, slug: categories.slug })
    .from(categories)
    .where(eq(categories.id, row.categoryId))
    .get()!
  const fabric =
    row.fabricId === null
      ? null
      : (db.select({ name: fabrics.name, slug: fabrics.slug }).from(fabrics).where(eq(fabrics.id, row.fabricId)).get() ??
        null)
  const occ = db
    .select({ name: occasions.name, slug: occasions.slug })
    .from(productOccasions)
    .innerJoin(occasions, eq(occasions.id, productOccasions.occasionId))
    .where(eq(productOccasions.productId, row.id))
    .orderBy(asc(occasions.name))
    .all()
  const mediaRows = db
    .select()
    .from(media)
    .where(eq(media.productId, row.id))
    .orderBy(asc(media.position), asc(media.id))
    .all()
  const photos = mediaRows.filter((m) => m.kind === 'photo').map(toPhoto)
  const videoRow = mediaRows.find((m) => m.kind === 'video')

  return {
    code: row.code,
    path: productPath(row),
    name: row.name,
    price: row.price,
    sold: row.status === 'sold',
    cover: photos[0] ?? null,
    category,
    fabric,
    occasions: occ,
    length: row.length,
    blousePiece: row.blousePiece,
    care: row.care,
    description: row.description,
    sizes: row.sizes,
    colours: row.colours,
    photos,
    video: videoRow ? { id: videoRow.id, path: videoRow.originalPath } : null,
    publishedAt: row.publishedAt ?? 0,
  }
}

/** Every available product's address, for the sitemap. */
export function listSitemapEntries(db: Db): { path: string; updatedAt: number }[] {
  return db
    .select({ code: products.code, slug: products.slug, updatedAt: products.updatedAt })
    .from(products)
    .where(eq(products.status, 'available'))
    .orderBy(desc(products.publishedAt), desc(products.id))
    .all()
    .map((r) => ({ path: productPath(r), updatedAt: r.updatedAt }))
}

export function relatedProducts(db: Db, code: string, limit = 8): PublicCard[] {
  const self = db
    .select({ id: products.id, categoryId: products.categoryId })
    .from(products)
    .where(eq(products.code, code.toUpperCase()))
    .get()
  if (!self) return []
  const rows = db
    .select(cardColumns)
    .from(products)
    .where(and(eq(products.categoryId, self.categoryId), eq(products.status, 'available'), ne(products.id, self.id)))
    .orderBy(desc(products.publishedAt), desc(products.id))
    .limit(limit)
    .all()
  return toCards(db, rows)
}

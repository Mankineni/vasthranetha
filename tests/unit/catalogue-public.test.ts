import { createTestDb } from '../helpers/db'
import { makeCategories, makeInput, makeMediaRow, makeUser } from '../helpers/fixtures'
import { createProduct, setStatus } from '@/lib/catalogue/admin'
import { getPublicProduct, listPublicProducts, listSitemapEntries, relatedProducts } from '@/lib/catalogue/public'
import { createFabric, createOccasion, savePriceBands, listPriceBands } from '@/lib/catalogue/taxonomy'
import { updateSettings } from '@/lib/settings/settings'
import type { ProductInput } from '@/lib/catalogue/types'

const DAY = 86_400_000
const NOW = 1000 * DAY

function setup() {
  const db = createTestDb()
  const cats = makeCategories(db)
  const user = makeUser(db)
  const add = (categoryId: number, o: Partial<ProductInput> = {}, publishedAt = NOW - DAY) =>
    createProduct(db, makeInput(categoryId, { mediaIds: [makeMediaRow(db)], ...o }), user, {
      publish: true,
      now: publishedAt,
    })
  return { db, ...cats, user, add }
}

test('drafts never appear', () => {
  const { db, sarees, user, add } = setup()
  add(sarees, { name: 'Live' })
  const draft = createProduct(db, makeInput(sarees, { name: 'Hidden' }), user, { publish: false, now: NOW })
  expect(listPublicProducts(db, { now: NOW }).items.map((p) => p.name)).toEqual(['Live'])
  expect(getPublicProduct(db, draft.code)).toBeNull()
  expect(relatedProducts(db, listPublicProducts(db, { now: NOW }).items[0].code).map((p) => p.name)).toEqual([])
})

test('sold products stay listed for the configured days, then leave listings but keep their page', () => {
  const { db, sarees, user, add } = setup()
  const recent = add(sarees, { name: 'Sold 6 days ago' })
  const old = add(sarees, { name: 'Sold 8 days ago' })
  setStatus(db, recent.id, 'sold', user, NOW - 6 * DAY)
  setStatus(db, old.id, 'sold', user, NOW - 8 * DAY)

  const listed = listPublicProducts(db, { now: NOW }).items
  expect(listed.map((p) => [p.name, p.sold])).toEqual([['Sold 6 days ago', true]])
  expect(getPublicProduct(db, old.code)).toMatchObject({ name: 'Sold 8 days ago', sold: true })

  updateSettings(db, { soldVisibleDays: 0 })
  const fresh = add(sarees, { name: 'Just sold' })
  setStatus(db, fresh.id, 'sold', user, NOW)
  expect(listPublicProducts(db, { now: NOW }).items).toEqual([])
})

test('filters narrow and combine', () => {
  const { db, sarees, dresses, add } = setup()
  const silk = createFabric(db, 'Soft silk')
  const cotton = createFabric(db, 'Cotton')
  const wedding = createOccasion(db, 'Wedding')
  if (!silk.ok || !cotton.ok || !wedding.ok) throw new Error('setup')
  savePriceBands(db, [
    { label: 'Under ₹999', min: 0, max: 999 },
    { label: 'Mid', min: 1000, max: 2499 },
    { label: 'Top', min: 2500, max: null },
  ])
  const [under, mid, top] = listPriceBands(db)
  add(sarees, { name: 'A', fabricId: silk.id, price: 1000, occasionIds: [wedding.id] })
  add(sarees, { name: 'B', fabricId: silk.id, price: 2499 })
  add(sarees, { name: 'C', fabricId: cotton.id, price: 999 })
  add(sarees, { name: 'D', fabricId: silk.id, price: 2500 })
  add(dresses, { name: 'E', fabricId: silk.id, price: 1500 })
  add(sarees, { name: 'F', fabricId: silk.id, price: 99999 })

  const names = (q: Parameters<typeof listPublicProducts>[1]) =>
    listPublicProducts(db, q)
      .items.map((p) => p.name)
      .sort()
  expect(names({ now: NOW, categorySlug: 'dresses' })).toEqual(['E'])
  expect(names({ now: NOW, fabricSlug: 'cotton' })).toEqual(['C'])
  expect(names({ now: NOW, occasionSlug: 'wedding' })).toEqual(['A'])
  expect(names({ now: NOW, priceBandId: mid.id })).toEqual(['A', 'B', 'E'])
  expect(names({ now: NOW, priceBandId: under.id })).toEqual(['C'])
  expect(names({ now: NOW, priceBandId: top.id })).toEqual(['D', 'F'])
  expect(names({ now: NOW, categorySlug: 'sarees', fabricSlug: 'soft-silk', priceBandId: mid.id })).toEqual(['A', 'B'])
  expect(names({ now: NOW, categorySlug: 'nope' })).toEqual([])
  expect(names({ now: NOW, priceBandId: 999999 })).toEqual([])
})

test('search matches name in any case, or the code', () => {
  const { db, sarees, add } = setup()
  const a = add(sarees, { name: 'Maroon Soft Silk' })
  add(sarees, { name: 'Teal Cotton' })
  expect(listPublicProducts(db, { now: NOW, q: 'SILK' }).items.map((p) => p.name)).toEqual(['Maroon Soft Silk'])
  expect(listPublicProducts(db, { now: NOW, q: a.code.toLowerCase() }).items.map((p) => p.code)).toEqual([a.code])
  expect(listPublicProducts(db, { now: NOW, q: '100%' }).items).toEqual([])
})

test('a code typed without the hyphen, or with a space, still finds the product', () => {
  const { db, sarees, add } = setup()
  const a = add(sarees, { name: 'Maroon Soft Silk' })
  const [prefix, number] = a.code.split('-')
  for (const typed of [`${prefix}${number}`, `${prefix.toLowerCase()} ${number}`, ` ${prefix}-${number} `]) {
    expect(listPublicProducts(db, { now: NOW, q: typed }).items.map((p) => p.code), typed).toEqual([a.code])
  }
})

test('sort orders, ties broken by newest', () => {
  const { db, sarees, add } = setup()
  add(sarees, { name: 'old-cheap', price: 500 }, NOW - 5 * DAY)
  add(sarees, { name: 'mid', price: 1500 }, NOW - 3 * DAY)
  add(sarees, { name: 'new-cheap', price: 500 }, NOW - 1 * DAY)
  const order = (sort: 'newest' | 'price-asc' | 'price-desc') =>
    listPublicProducts(db, { now: NOW, sort }).items.map((p) => p.name)
  expect(order('newest')).toEqual(['new-cheap', 'mid', 'old-cheap'])
  expect(order('price-asc')).toEqual(['new-cheap', 'old-cheap', 'mid'])
  expect(order('price-desc')).toEqual(['mid', 'new-cheap', 'old-cheap'])
})

test('paging returns the rest and the total; limit is capped at 48', () => {
  const { db, sarees, add } = setup()
  for (let i = 0; i < 30; i++) add(sarees, { name: `P${i}` }, NOW - i * 1000)
  expect(listPublicProducts(db, { now: NOW }).items).toHaveLength(24)
  const page2 = listPublicProducts(db, { now: NOW, offset: 24 })
  expect(page2.items).toHaveLength(6)
  expect(page2.total).toBe(30)
  for (let i = 30; i < 60; i++) add(sarees, { name: `P${i}` }, NOW - i * 1000)
  expect(listPublicProducts(db, { now: NOW, limit: 500 }).items).toHaveLength(48)
})

test('product detail and related products', () => {
  const { db, sarees, dresses, user, add } = setup()
  const silk = createFabric(db, 'Soft silk')
  const party = createOccasion(db, 'Party')
  if (!silk.ok || !party.ok) throw new Error('setup')
  const video = makeMediaRow(db, 'video')
  const p1 = makeMediaRow(db)
  const p2 = makeMediaRow(db)
  const main = add(sarees, {
    name: 'Main',
    fabricId: silk.id,
    occasionIds: [party.id],
    sizes: ['S'],
    blousePiece: true,
    mediaIds: [p1, video, p2],
  })
  for (let i = 0; i < 10; i++) add(sarees, { name: `Rel${i}` }, NOW - (i + 2) * DAY)
  const sold = add(sarees, { name: 'SoldOne' })
  setStatus(db, sold.id, 'sold', user, NOW)
  add(dresses, { name: 'OtherCat' })

  const p = getPublicProduct(db, main.code.toLowerCase())!
  expect(p).toMatchObject({
    code: main.code,
    path: `/p/${main.code.toLowerCase()}-main`,
    category: { name: 'Sarees', slug: 'sarees' },
    fabric: { name: 'Soft silk', slug: 'soft-silk' },
    occasions: [{ name: 'Party', slug: 'party' }],
    sizes: ['S'],
    blousePiece: true,
    sold: false,
  })
  expect(p.photos.map((m) => m.id)).toEqual([p1, p2])
  expect(p.video?.id).toBe(video)
  expect(p.video?.path).toMatch(/-orig\.jpg$/)
  expect(p.cover?.id).toBe(p1)

  const related = relatedProducts(db, main.code)
  expect(related).toHaveLength(8)
  expect(related.map((r) => r.name)).not.toContain('Main')
  expect(related.map((r) => r.name)).not.toContain('SoldOne')
  expect(related.map((r) => r.name)).not.toContain('OtherCat')
  expect(related[0].name).toBe('Rel0')
})

test('sitemap entries are the available products only', () => {
  const { db, sarees, user, add } = setup()
  const live = add(sarees, { name: 'Live One' }, NOW - 2 * DAY)
  const sold = add(sarees, { name: 'Sold One' })
  setStatus(db, sold.id, 'sold', user, NOW)
  createProduct(db, makeInput(sarees, { name: 'Draft One' }), user, { publish: false, now: NOW })
  expect(listSitemapEntries(db)).toEqual([
    { path: `/p/${live.code.toLowerCase()}-live-one`, updatedAt: NOW - 2 * DAY },
  ])
})

test('public media never expose a photo original; a video gives its playable path', () => {
  const { db, sarees, add } = setup()
  const photo = makeMediaRow(db, 'photo', 'ab/photohash-orig.jpg')
  const video = makeMediaRow(db, 'video', 'cd/videohash-orig.mp4')
  const p = add(sarees, { mediaIds: [photo, video] })
  const out = JSON.stringify([getPublicProduct(db, p.code), listPublicProducts(db, { now: NOW }), relatedProducts(db, p.code)])
  expect(out).not.toContain('photohash-orig')
  expect(out).not.toContain('originalPath')
  expect(getPublicProduct(db, p.code)!.video).toEqual({ id: video, path: 'cd/videohash-orig.mp4' })
})

test('dealer fields never leave the public functions', () => {
  const { db, sarees, add } = setup()
  const p = add(sarees, { dealerName: 'ZZDEALER', dealerCode: 'ZZCODE', dealerPrice: 777123, notes: 'ZZNOTE' })
  add(sarees, { name: 'Neighbour' })
  const out = JSON.stringify([
    listPublicProducts(db, { now: NOW }),
    getPublicProduct(db, p.code),
    relatedProducts(db, p.code),
    listPublicProducts(db, { now: NOW, q: p.code }),
    listSitemapEntries(db),
  ])
  for (const secret of ['ZZDEALER', 'ZZCODE', '777123', 'ZZNOTE', 'dealer', 'notes', 'submitToken', 'createdBy']) {
    expect(out).not.toContain(secret)
  }
})

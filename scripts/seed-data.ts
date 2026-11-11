import { eq } from 'drizzle-orm'
import sharp from 'sharp'
import type { Db } from '@/db/client'
import { products, users } from '@/db/schema'
import { createProduct, setStatus } from '@/lib/catalogue/admin'
import {
  createCategory,
  createFabric,
  createOccasion,
  listCategories,
  listFabrics,
  listOccasions,
  savePriceBands,
} from '@/lib/catalogue/taxonomy'
import { savePhoto } from '@/lib/media/store'
import { savePage } from '@/lib/settings/pages'
import { updateSettings } from '@/lib/settings/settings'
import {
  SEED_BANDS,
  SEED_BRAND,
  SEED_CATEGORIES,
  SEED_FABRICS,
  SEED_OCCASIONS,
  SEED_PAGES,
  SEED_PRODUCTS,
  SEED_TAGLINE,
  SEED_WHATSAPP,
} from './seed-catalogue'

const DAY = 86_400_000

function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16)
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) =>
    Math.max(0, Math.min(255, Math.round(amount > 0 ? v + (255 - v) * amount : v * (1 + amount)))),
  )
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

function escapeXml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
}

/** A sample "drape" picture: base colour, woven stripes, a zari-like border and the product name. */
async function samplePhoto(name: string, colour: string, index: number): Promise<Buffer> {
  const W = 1800
  const H = 2400
  const dark = shade(colour, -0.35)
  const light = shade(colour, 0.25)
  const stripes = Array.from({ length: 30 }, (_, i) => {
    const x = i * 60 + index * 17
    return `<rect x="${x}" y="0" width="${i % 3 === 0 ? 14 : 4}" height="${H}" fill="${i % 2 ? dark : light}" opacity="0.35"/>`
  }).join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${light}"/><stop offset="0.55" stop-color="${colour}"/><stop offset="1" stop-color="${dark}"/>
    </linearGradient></defs>
    <rect width="${W}" height="${H}" fill="url(#g)"/>
    ${stripes}
    <rect x="0" y="${H - 360}" width="${W}" height="220" fill="#c9a646" opacity="0.85"/>
    <rect x="0" y="${H - 330}" width="${W}" height="12" fill="#fff4c2" opacity="0.9"/>
    <rect x="0" y="${H - 182}" width="${W}" height="12" fill="#fff4c2" opacity="0.9"/>
    <text x="${W / 2}" y="${H / 2}" font-family="Georgia, serif" font-size="110" fill="#ffffff" fill-opacity="0.9"
      text-anchor="middle">${escapeXml(name)}</text>
    <text x="${W / 2}" y="${H / 2 + 150}" font-family="Georgia, serif" font-size="70" fill="#ffffff" fill-opacity="0.75"
      text-anchor="middle">Sample photo ${index + 1}</text>
  </svg>`
  return sharp(Buffer.from(svg)).jpeg({ quality: 88 }).toBuffer()
}

/** Fills an empty database with the sample catalogue. Throws if products already exist. */
export async function seedDatabase(db: Db, mediaDir: string, now = Date.now(), log = console.log): Promise<void> {
  if (db.select({ id: products.id }).from(products).limit(1).get()) {
    throw new Error('The database already has products. Use --force to seed anyway.')
  }

  let user = db.select().from(users).where(eq(users.login, 'seed@local')).get()
  if (!user) {
    // '!' is not a valid hash, so this account can never sign in.
    user = db.insert(users).values({ name: 'Sample data', login: 'seed@local', passwordHash: '!' }).returning().get()
  }

  for (const c of SEED_CATEGORIES) if (!listCategories(db).some((x) => x.name === c.name)) createCategory(db, c)
  for (const f of SEED_FABRICS) if (!listFabrics(db).some((x) => x.name === f)) createFabric(db, f)
  for (const o of SEED_OCCASIONS) if (!listOccasions(db).some((x) => x.name === o)) createOccasion(db, o)
  savePriceBands(db, SEED_BANDS)
  updateSettings(db, { brandName: SEED_BRAND, tagline: SEED_TAGLINE, whatsappNumber: SEED_WHATSAPP })
  for (const [slug, page] of Object.entries(SEED_PAGES)) savePage(db, slug as keyof typeof SEED_PAGES, page)

  const catId = new Map(listCategories(db).map((c) => [c.name, c.id]))
  const fabId = new Map(listFabrics(db).map((f) => [f.name, f.id]))
  const occId = new Map(listOccasions(db).map((o) => [o.name, o.id]))

  // Oldest first, so "newest" ordering matches daysAgo.
  const ordered = [...SEED_PRODUCTS].sort((a, b) => b.daysAgo - a.daysAgo)
  for (const [i, p] of ordered.entries()) {
    const at = now - p.daysAgo * DAY - (ordered.length - i) * 60_000
    const mediaIds: number[] = []
    for (let k = 0; k < p.photos; k++) {
      const m = await savePhoto(db, await samplePhoto(p.name, p.colour, k), { batchId: `seed-${i}`, mediaDir, now: at })
      mediaIds.push(m.id)
    }
    const created = createProduct(
      db,
      {
        name: p.name,
        price: p.price,
        categoryId: catId.get(p.category)!,
        fabricId: fabId.get(p.fabric) ?? null,
        occasionIds: p.occasions.map((o) => occId.get(o)!),
        length: p.length ?? '',
        blousePiece: p.blousePiece ?? null,
        care: p.care ?? '',
        description: p.description ?? '',
        sizes: p.sizes ?? [],
        colours: [],
        dealerName: 'Sample dealer',
        dealerCode: `SD-${100 + i}`,
        dealerPrice: Math.round(p.price * 0.75),
        notes: '',
        mediaIds,
        submitToken: `seed-${i}`,
      },
      user.id,
      { publish: p.state !== 'draft', now: at },
    )
    if (p.state && p.state !== 'draft') setStatus(db, created.id, 'sold', user.id, now - p.state.soldDaysAgo * DAY)
    log(`  ${created.code}  ${p.name}`)
  }
}

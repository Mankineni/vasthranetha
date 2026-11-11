import { randomUUID } from 'node:crypto'
import type { Db } from '@/db/client'
import { media, users } from '@/db/schema'
import type { ProductInput } from '@/lib/catalogue/types'
import { createCategory } from '@/lib/catalogue/taxonomy'

export function makeUser(db: Db, name = 'Owner'): number {
  const [u] = db
    .insert(users)
    .values({ name, login: `${name.toLowerCase()}-${randomUUID()}@test.local`, passwordHash: 'x' })
    .returning()
    .all()
  return u.id
}

export function makeCategories(db: Db) {
  const sarees = createCategory(db, { name: 'Sarees', codePrefix: 'S' })
  const dresses = createCategory(db, { name: 'Dresses', codePrefix: 'D' })
  if (!sarees.ok || !dresses.ok) throw new Error('category setup failed')
  return { sarees: sarees.id, dresses: dresses.id }
}

/** Inserts an unattached media row directly (no files) and returns its id. */
export function makeMediaRow(db: Db, kind: 'photo' | 'video' = 'photo', path = `${randomUUID()}-orig.jpg`): number {
  const [m] = db
    .insert(media)
    .values({ kind, originalPath: path, width: 1800, height: 2400, variants: [], createdAt: Date.now(), batchId: 'b' })
    .returning()
    .all()
  return m.id
}

export function makeInput(categoryId: number, overrides: Partial<ProductInput> = {}): ProductInput {
  return {
    name: 'Maroon Soft Silk',
    price: 1850,
    categoryId,
    fabricId: null,
    occasionIds: [],
    length: '',
    blousePiece: null,
    care: '',
    description: '',
    sizes: [],
    colours: [],
    dealerName: '',
    dealerCode: '',
    dealerPrice: null,
    notes: '',
    mediaIds: [],
    submitToken: randomUUID(),
    ...overrides,
  }
}

import { eq } from 'drizzle-orm'
import type { Db, Tx } from '@/db/client'
import { categories, settings } from '@/db/schema'

const FIRST_CODE_NUMBER = 1001
const COUNTER_KEY = 'nextCodeNumber'

/** Lower-case ASCII letters and digits joined by '-', at most 60 chars; '' if nothing usable. */
export function slugify(text: string): string {
  const ascii = text.normalize('NFKD').replace(/[̀-ͯ]/g, '')
  return ascii
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '')
}

export function productPath(p: { code: string; slug: string }): string {
  const code = p.code.toLowerCase()
  return p.slug ? `/p/${code}-${p.slug}` : `/p/${code}`
}

/** A search that looks like a product code ("S1042", "s 1042", "S-1042") in stored form, else null. */
export function normaliseCodeQuery(q: string): string | null {
  const m = /^\s*([a-z]{1,3})[\s-]*(\d+)\s*$/i.exec(q)
  return m ? `${m[1].toUpperCase()}-${m[2]}` : null
}

export function parseProductPath(segment: string): { code: string } | null {
  const m = /^([a-z]{1,3})-(\d+)(-.*)?$/i.exec(segment)
  return m ? { code: `${m[1].toUpperCase()}-${m[2]}` } : null
}

/** Next product code for a category. Call inside the transaction that inserts the product. */
export function nextCode(db: Db | Tx, categoryId: number): string {
  const cat = db.select({ prefix: categories.codePrefix }).from(categories).where(eq(categories.id, categoryId)).get()
  if (!cat) throw new Error(`Unknown category ${categoryId}`)
  const row = db.select().from(settings).where(eq(settings.key, COUNTER_KEY)).get()
  const n: number = row ? JSON.parse(row.value) : FIRST_CODE_NUMBER
  const value = JSON.stringify(n + 1)
  db.insert(settings)
    .values({ key: COUNTER_KEY, value })
    .onConflictDoUpdate({ target: settings.key, set: { value } })
    .run()
  return `${cat.prefix}-${n}`
}

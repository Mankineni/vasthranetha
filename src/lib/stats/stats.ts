import { and, desc, eq, gte, ne, sql } from 'drizzle-orm'
import type { Db } from '@/db/client'
import { events, products } from '@/db/schema'

export type EventType = 'view' | 'order_tap'

export type TopItem = { code: string; name: string; count: number }
export type Summary = {
  live: number
  addedThisWeek: number
  soldThisWeek: number
  topViewed: TopItem[]
  topOrderTaps: TopItem[]
}

const DAY_MS = 86_400_000
// India has one fixed offset (UTC+5:30) and no daylight saving.
const INDIA_OFFSET_MS = 5.5 * 60 * 60 * 1000
const WEEK_DAYS = 7

const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp/i

/** True for crawlers and link-preview fetchers, and for requests without a user agent. */
export function isBot(userAgent: string | null): boolean {
  return !userAgent || BOT.test(userAgent)
}

/** Calendar date in India, as YYYY-MM-DD. */
export function indiaDay(ts: number): string {
  return new Date(ts + INDIA_OFFSET_MS).toISOString().slice(0, 10)
}

/** Start (epoch ms) of the Indian calendar day `daysBack` days before `ts`. */
function indiaDayStart(ts: number, daysBack: number): number {
  const local = ts + INDIA_OFFSET_MS
  return Math.floor(local / DAY_MS) * DAY_MS - daysBack * DAY_MS - INDIA_OFFSET_MS
}

/** Counts one view or order tap. Returns false when ignored (bot, unknown code, draft). */
export function recordEvent(db: Db, code: string, type: EventType, now: number, userAgent: string | null): boolean {
  if (isBot(userAgent)) return false
  const product = db
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.code, code.toUpperCase()), ne(products.status, 'draft')))
    .get()
  if (!product) return false
  db.insert(events)
    .values({ productId: product.id, type, day: indiaDay(now), count: 1 })
    .onConflictDoUpdate({
      target: [events.productId, events.type, events.day],
      set: { count: sql`${events.count} + 1` },
    })
    .run()
  return true
}

function top(db: Db, type: EventType, sinceDay: string): TopItem[] {
  const total = sql<number>`sum(${events.count})`
  return db
    .select({ code: products.code, name: products.name, count: total })
    .from(events)
    .innerJoin(products, eq(products.id, events.productId))
    .where(and(eq(events.type, type), gte(events.day, sinceDay)))
    .groupBy(products.id)
    .orderBy(desc(total), products.name)
    .limit(10)
    .all()
}

/** The admin home numbers. "This week" is the last 7 Indian calendar days, today included. */
export function getSummary(db: Db, now: number): Summary {
  const since = indiaDayStart(now, WEEK_DAYS - 1)
  const count = (where: ReturnType<typeof and>) =>
    db.select({ n: sql<number>`count(*)` }).from(products).where(where).get()!.n
  return {
    live: count(eq(products.status, 'available')),
    addedThisWeek: count(and(ne(products.status, 'draft'), gte(products.publishedAt, since))),
    soldThisWeek: count(and(eq(products.status, 'sold'), gte(products.soldAt, since))),
    topViewed: top(db, 'view', indiaDay(since)),
    topOrderTaps: top(db, 'order_tap', indiaDay(since)),
  }
}

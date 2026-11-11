import { createTestDb } from '../helpers/db'
import { makeCategories, makeInput, makeMediaRow, makeUser } from '../helpers/fixtures'
import { events } from '@/db/schema'
import { createProduct, setStatus } from '@/lib/catalogue/admin'
import { getSummary, indiaDay, isBot, recordEvent } from '@/lib/stats/stats'

const DAY = 86_400_000
// 2026-11-11 12:00 UTC (17:30 in India)
const NOW = Date.UTC(2026, 10, 11, 12, 0)
const PHONE = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Mobile Safari/537.36'

function setup() {
  const db = createTestDb()
  const { sarees } = makeCategories(db)
  const user = makeUser(db)
  const add = (name: string, publishedAt = NOW - 30 * DAY) =>
    createProduct(db, makeInput(sarees, { name, mediaIds: [makeMediaRow(db)] }), user, { publish: true, now: publishedAt })
  return { db, sarees, user, add }
}

test.each([
  [null, true],
  ['', true],
  ['Googlebot/2.1 (+http://www.google.com/bot.html)', true],
  ['facebookexternalhit/1.1', true],
  ['WhatsApp/2.23.20.0 A', true],
  ['Mozilla/5.0 (compatible; bingbot/2.0)', true],
  [PHONE, false],
])('isBot(%j) → %s', (ua, expected) => {
  expect(isBot(ua)).toBe(expected)
})

test('India day: 23:50 UTC is already the next day in India', () => {
  expect(indiaDay(Date.UTC(2026, 10, 11, 23, 50))).toBe('2026-11-12')
  expect(indiaDay(Date.UTC(2026, 10, 11, 18, 29))).toBe('2026-11-11')
})

test('two views on the same day add up in one row', () => {
  const { db, add } = setup()
  const p = add('Red Silk')
  expect(recordEvent(db, p.code, 'view', NOW, PHONE)).toBe(true)
  expect(recordEvent(db, p.code.toLowerCase(), 'view', NOW + 1000, PHONE)).toBe(true)
  expect(db.select().from(events).all()).toEqual([{ productId: p.id, type: 'view', day: '2026-11-11', count: 2 }])
})

test('a view at 23:50 UTC is stored on the next Indian date', () => {
  const { db, add } = setup()
  const p = add('Red Silk')
  recordEvent(db, p.code, 'view', Date.UTC(2026, 10, 11, 23, 50), PHONE)
  expect(db.select().from(events).all()[0].day).toBe('2026-11-12')
})

test('bots, unknown codes and drafts are ignored', () => {
  const { db, sarees, user, add } = setup()
  const p = add('Red Silk')
  const draft = createProduct(db, makeInput(sarees, { name: 'Draft' }), user, { publish: false, now: NOW })
  expect(recordEvent(db, p.code, 'view', NOW, 'Googlebot/2.1')).toBe(false)
  expect(recordEvent(db, 'S-999999', 'view', NOW, PHONE)).toBe(false)
  expect(recordEvent(db, draft.code, 'order_tap', NOW, PHONE)).toBe(false)
  expect(db.select().from(events).all()).toHaveLength(0)
})

test('summary counts live products, added and sold in the last 7 days', () => {
  const { db, user, add } = setup()
  add('Old one', NOW - 30 * DAY)
  add('This week', NOW - 6 * DAY)
  add('Today', NOW)
  add('Eight days ago', NOW - 8 * DAY)
  const sold = add('Sold this week', NOW - 20 * DAY)
  setStatus(db, sold.id, 'sold', user, NOW - 2 * DAY)
  const soldLongAgo = add('Sold long ago', NOW - 40 * DAY)
  setStatus(db, soldLongAgo.id, 'sold', user, NOW - 9 * DAY)

  const s = getSummary(db, NOW)
  expect(s.live).toBe(4)
  expect(s.addedThisWeek).toBe(2)
  expect(s.soldThisWeek).toBe(1)
})

test('top lists: last 7 days only, highest first, at most 10', () => {
  const { db, add } = setup()
  const products = Array.from({ length: 12 }, (_, i) => add(`P${String(i).padStart(2, '0')}`))
  products.forEach((p, i) => {
    for (let k = 0; k <= i; k++) recordEvent(db, p.code, 'view', NOW, PHONE)
  })
  // Old events do not count.
  for (let k = 0; k < 50; k++) recordEvent(db, products[0].code, 'view', NOW - 8 * DAY, PHONE)
  recordEvent(db, products[3].code, 'order_tap', NOW - DAY, PHONE)
  recordEvent(db, products[3].code, 'order_tap', NOW, PHONE)
  recordEvent(db, products[5].code, 'order_tap', NOW, PHONE)

  const s = getSummary(db, NOW)
  expect(s.topViewed).toHaveLength(10)
  expect(s.topViewed[0]).toEqual({ code: products[11].code, name: 'P11', count: 12 })
  expect(s.topViewed.map((t) => t.count)).toEqual([12, 11, 10, 9, 8, 7, 6, 5, 4, 3])
  expect(s.topOrderTaps).toEqual([
    { code: products[3].code, name: 'P03', count: 2 },
    { code: products[5].code, name: 'P05', count: 1 },
  ])
})

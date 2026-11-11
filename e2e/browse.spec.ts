import { expect, test } from '@playwright/test'
import { listedSeed, SEED_BRAND, SEED_PAGES, SEED_PRODUCTS, SEED_WHATSAPP } from '../scripts/seed-catalogue'

const cards = 'a[data-testid="product-card"]'

test('home shows brand, new arrivals, categories, price bands and how to order', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('banner')).toContainText(SEED_BRAND)
  const newArrivals = page.getByTestId('new-arrivals')
  await expect(newArrivals.locator(cards).first()).toBeVisible()
  expect(await newArrivals.locator(cards).count()).toBeGreaterThanOrEqual(8)
  await expect(page.getByTestId('category-tiles').getByRole('link', { name: 'Sarees' })).toBeVisible()
  await expect(page.getByTestId('category-tiles').getByRole('link', { name: 'Dresses' })).toBeVisible()
  await expect(page.getByTestId('price-bands').getByRole('link')).toHaveCount(3)
  await expect(page.getByTestId('how-to-order').getByRole('listitem')).toHaveCount(3)
})

test('home has no horizontal scroll on a phone', async ({ page }) => {
  await page.goto('/')
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(0)
})

test('sarees category lists every listed saree', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('category-tiles').getByRole('link', { name: 'Sarees' }).click()
  await expect(page).toHaveURL(/\/c\/sarees$/)
  const expected = listedSeed.filter((p) => p.category === 'Sarees').length
  await expect(page.locator(cards)).toHaveCount(expected)
})

test('new arrivals loads more when scrolled to the end', async ({ page }) => {
  await page.goto('/new')
  await expect(page.locator(cards)).toHaveCount(24)
  await page.getByTestId('grid-end').scrollIntoViewIfNeeded()
  await expect(page.locator(cards)).toHaveCount(listedSeed.length)
})

test('fabric filter narrows the list and lands in the URL', async ({ page }) => {
  await page.goto('/c/sarees')
  await page.getByLabel('Fabric').selectOption('cotton')
  await expect(page).toHaveURL(/fabric=cotton/)
  const cotton = listedSeed.filter((p) => p.category === 'Sarees' && p.fabric === 'Cotton')
  await expect(page.locator(cards)).toHaveCount(cotton.length)
  for (const p of cotton) await expect(page.locator(cards, { hasText: p.name })).toBeVisible()
})

test('new arrivals can be filtered by category', async ({ page }) => {
  await page.goto('/new')
  await page.getByLabel('Category').selectOption('dresses')
  await expect(page).toHaveURL(/category=dresses/)
  const dresses = listedSeed.filter((p) => p.category === 'Dresses')
  await expect(page.locator(cards)).toHaveCount(dresses.length)
  for (const p of dresses) await expect(page.locator(cards, { hasText: p.name })).toBeVisible()
})

test('a category page has no category filter (it is the category)', async ({ page }) => {
  await page.goto('/c/sarees')
  await expect(page.getByLabel('Fabric')).toBeVisible()
  await expect(page.getByLabel('Category')).toHaveCount(0)
})

test('sort by price puts the cheapest saree first', async ({ page }) => {
  await page.goto('/c/sarees')
  await page.getByLabel('Sort').selectOption('price-asc')
  await expect(page).toHaveURL(/sort=price-asc/)
  const cheapest = [...listedSeed].filter((p) => p.category === 'Sarees').sort((a, b) => a.price - b.price)[0]
  await expect(page.locator(cards).first()).toContainText(cheapest.name)
})

test('recently sold shows a Sold label; old sold and drafts are absent', async ({ page }) => {
  await page.goto('/new')
  await page.getByTestId('grid-end').scrollIntoViewIfNeeded()
  await expect(page.locator(cards)).toHaveCount(listedSeed.length)
  await expect(page.locator(cards, { hasText: 'Ruby Banarasi Silk Saree' })).toContainText('Sold')
  await expect(page.locator(cards, { hasText: 'Maroon Soft Silk Saree' })).not.toContainText('Sold')
  for (const p of SEED_PRODUCTS.filter((s) => !listedSeed.includes(s))) {
    await expect(page.locator(cards, { hasText: p.name })).toHaveCount(0)
  }
})

test('search by product code finds exactly that product', async ({ page, request }) => {
  const res = await request.get('/api/products?q=Mint%20Handloom')
  const { items } = await res.json()
  expect(items).toHaveLength(1)
  await page.goto(`/search?q=${items[0].code}`)
  await expect(page.locator(cards)).toHaveCount(1)
  await expect(page.locator(cards)).toContainText('Mint Handloom Cotton Saree')
})

test('content page and floating WhatsApp button', async ({ page }) => {
  await page.goto('/about')
  await expect(page.getByRole('heading', { name: SEED_PAGES.about.title })).toBeVisible()
  await expect(page.getByText('We are two friends who love sarees and dresses.')).toBeVisible()
  const fab = page.getByTestId('whatsapp-fab')
  await expect(fab).toHaveAttribute('href', new RegExp(`^https://wa\\.me/${SEED_WHATSAPP}\\?text=`))
})

test('unknown content page is not found', async ({ page }) => {
  const res = await page.goto('/privacy-nonsense')
  expect(res?.status()).toBe(404)
})

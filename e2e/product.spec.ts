import { expect, test, type Page } from '@playwright/test'
import { E2E_SITE_URL } from '../playwright.config'
import { formatPrice } from '../src/lib/format'
import { buildOrderMessage } from '../src/lib/whatsapp/message'
import { listedSeed, SEED_PRODUCTS, SEED_WHATSAPP, seedCode, seedProduct } from '../scripts/seed-catalogue'

const SAREE = 'Maroon Soft Silk Saree' // 4 photos, soft silk, has length, blouse and care
const DRESS = 'Teal Cotton Anarkali Dress' // sizes S to XL
const SOLD = 'Ruby Banarasi Silk Saree' // sold 2 days ago
const DRAFT = SEED_PRODUCTS.find((p) => p.state === 'draft')!.name

const slugOf = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
const pathOf = (name: string) => `/p/${seedCode(name).toLowerCase()}-${slugOf(name)}`
const decodedHref = async (page: Page) =>
  decodeURIComponent(new URL((await page.getByTestId('order-button').getAttribute('href'))!).searchParams.get('text')!)

test('saree page shows name, price, code, details and every photo', async ({ page }) => {
  const p = seedProduct(SAREE)
  await page.goto(pathOf(SAREE))
  await expect(page.getByRole('heading', { level: 1, name: SAREE })).toBeVisible()
  await expect(page.getByTestId('price')).toHaveText(formatPrice(p.price))
  await expect(page.getByText(`Code: ${seedCode(SAREE)}`)).toBeVisible()
  const details = page.getByTestId('details')
  await expect(details).toContainText('Soft silk')
  await expect(details).toContainText('6.3 m')
  await expect(details).toContainText('Blouse piece')
  await expect(page.getByTestId('gallery').locator('img')).toHaveCount(p.photos)
})

test('empty detail fields render no label', async ({ page }) => {
  await page.goto(pathOf(DRESS)) // no length, no blouse piece
  const details = page.getByTestId('details')
  await expect(details).not.toContainText('Length')
  await expect(details).not.toContainText('Blouse piece')
})

test('order button opens WhatsApp with the spec message', async ({ page }) => {
  const p = seedProduct(SAREE)
  await page.goto(pathOf(SAREE))
  const href = (await page.getByTestId('order-button').getAttribute('href'))!
  expect(href.startsWith(`https://wa.me/${SEED_WHATSAPP}?text=`)).toBe(true)
  expect(await decodedHref(page)).toBe(
    buildOrderMessage({ name: SAREE, code: seedCode(SAREE), price: p.price, url: E2E_SITE_URL + pathOf(SAREE) }),
  )
})

test('a dress needs a size before ordering, and the size goes into the message', async ({ page }) => {
  await page.goto(pathOf(DRESS))
  await expect(page.getByTestId('order-button')).toBeDisabled()
  await page.getByRole('group', { name: 'Size' }).getByText('M', { exact: true }).click()
  await expect(page.getByRole('radio', { name: 'M', exact: true })).toBeChecked()
  await expect(page.getByTestId('order-button')).toBeEnabled()
  expect((await decodedHref(page)).split('\n')).toContain('Size: M')
})

test('tapping a photo opens the zoom viewer on the largest image', async ({ page }) => {
  await page.goto(pathOf(SAREE))
  await page.getByTestId('gallery').locator('img').first().click()
  const viewer = page.getByTestId('zoom-viewer')
  await expect(viewer).toBeVisible()
  await expect(viewer.locator('img')).toHaveAttribute('src', /-2400\.webp$/)
  await viewer.getByRole('button', { name: 'Close' }).click()
  await expect(viewer).toHaveCount(0)
  await expect(page.getByRole('heading', { level: 1, name: SAREE })).toBeVisible()
})

test('a sold product shows Sold and offers something similar instead of ordering', async ({ page }) => {
  await page.goto(pathOf(SOLD))
  await expect(page.getByTestId('sold-label')).toBeVisible()
  await expect(page.getByTestId('order-button')).toHaveCount(0)
  const similar = page.getByRole('link', { name: 'Ask for something similar on WhatsApp' })
  await expect(similar).toHaveAttribute('href', new RegExp(`^https://wa\\.me/${SEED_WHATSAPP}\\?text=`))
})

test('more like this: same category, available, not itself, at most 8', async ({ page }) => {
  await page.goto(pathOf(SAREE))
  const related = page.getByTestId('related').locator('a[data-testid="product-card"]')
  const count = await related.count()
  expect(count).toBeGreaterThan(0)
  expect(count).toBeLessThanOrEqual(8)
  const names = await related.allInnerTexts()
  const available = listedSeed.filter((p) => p.category === 'Sarees' && !p.state).map((p) => p.name)
  for (const text of names) {
    expect(text).not.toContain(SAREE)
    expect(available.some((n) => text.includes(n))).toBe(true)
  }
})

test('outdated name and upper-case code redirect to the current address', async ({ page }) => {
  const code = seedCode(SAREE)
  for (const path of [`/p/${code.toLowerCase()}-old-name`, `/p/${code}`, `/p/${code}-${slugOf(SAREE)}`]) {
    await page.goto(path)
    expect(new URL(page.url()).pathname).toBe(pathOf(SAREE))
  }
})

test('a draft code and an unknown code are not found', async ({ page }) => {
  for (const path of [`/p/${seedCode(DRAFT).toLowerCase()}`, '/p/s-999999', '/p/hello']) {
    const res = await page.goto(path)
    expect(res?.status()).toBe(404)
    await expect(page.getByRole('link', { name: 'See new arrivals' })).toHaveAttribute('href', '/new')
  }
})

test('link preview tags and product structured data', async ({ page }) => {
  const p = seedProduct(SAREE)
  await page.goto(pathOf(SAREE))
  const meta = (prop: string) => page.locator(`meta[property="${prop}"]`).first().getAttribute('content')
  expect(await meta('og:title')).toBe(SAREE)
  expect(await meta('og:image')).toMatch(new RegExp(`^${E2E_SITE_URL}/media/.+-og\\.jpg$`))
  expect(Number(await meta('og:image:width'))).toBe(900)
  expect(Number(await meta('og:image:height'))).toBe(1200)
  expect(await meta('og:description')).toContain(formatPrice(p.price))

  const ld = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent())!)
  expect(ld['@type']).toBe('Product')
  expect(ld.sku).toBe(seedCode(SAREE))
  expect(ld.offers.priceCurrency).toBe('INR')
  expect(ld.offers.price).toBe(String(p.price))
  expect(ld.offers.availability).toBe('https://schema.org/InStock')

  await page.goto(pathOf(SOLD))
  const sold = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent())!)
  expect(sold.offers.availability).toBe('https://schema.org/SoldOut')
})

test('the preview image itself is served', async ({ page, request }) => {
  await page.goto(pathOf(SAREE))
  const url = (await page.locator('meta[property="og:image"]').first().getAttribute('content'))!
  const res = await request.get(new URL(url).pathname)
  expect(res.status()).toBe(200)
  expect(res.headers()['content-type']).toBe('image/jpeg')
})

test('sitemap lists home, categories and available products, never drafts', async ({ request }) => {
  const xml = await (await request.get('/sitemap.xml')).text()
  expect(xml).toContain(`<loc>${E2E_SITE_URL}</loc>`)
  expect(xml).toContain(`${E2E_SITE_URL}/c/sarees`)
  expect(xml).toContain(`${E2E_SITE_URL}/c/dresses`)
  for (const p of SEED_PRODUCTS.filter((s) => !s.state)) expect(xml).toContain(E2E_SITE_URL + pathOf(p.name))
  for (const p of SEED_PRODUCTS.filter((s) => s.state === 'draft')) {
    expect(xml).not.toContain(`/p/${seedCode(p.name).toLowerCase()}`)
  }
})

test('robots keeps crawlers out of admin and points at the sitemap', async ({ request }) => {
  const txt = await (await request.get('/robots.txt')).text()
  expect(txt).toContain('Disallow: /admin')
  expect(txt).toContain(`Sitemap: ${E2E_SITE_URL}/sitemap.xml`)
})

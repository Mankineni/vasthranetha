import { expect, test, type Page } from '@playwright/test'
import {
  SEED_BANDS,
  SEED_BRAND,
  SEED_CATEGORIES,
  SEED_FABRICS,
  SEED_PAGES,
  SEED_TAGLINE,
  SEED_WHATSAPP,
  seedCode,
} from '../scripts/seed-catalogue'
import { deleteCategory, deleteFabric, listCategories, listFabrics, savePriceBands, updateCategory } from '../src/lib/catalogue/taxonomy'
import { savePage } from '../src/lib/settings/pages'
import { updateSettings } from '../src/lib/settings/settings'
import { withDb } from './db'
import { fixture, signInAsOwner } from './helpers'

const SAREE_PATH = `/p/${seedCode('Maroon Soft Silk Saree').toLowerCase()}-maroon-soft-silk-saree`

test.beforeEach(async ({ page }) => {
  await signInAsOwner(page)
})

// Put every shared setting back so later specs see the seed again.
test.afterAll(() => {
  withDb((db) => {
    updateSettings(db, {
      brandName: SEED_BRAND,
      tagline: SEED_TAGLINE,
      whatsappNumber: SEED_WHATSAPP,
      soldVisibleDays: 7,
      banner: null,
      logo: null,
      customerPhotos: [],
    })
    savePriceBands(db, SEED_BANDS)
    savePage(db, 'about', SEED_PAGES.about)
    for (const c of listCategories(db)) {
      if (!SEED_CATEGORIES.some((s) => s.name === c.name)) deleteCategory(db, c.id)
      else updateCategory(db, c.id, { position: SEED_CATEGORIES.findIndex((s) => s.name === c.name), tileImage: null })
    }
    for (const f of listFabrics(db)) if (!SEED_FABRICS.includes(f.name)) deleteFabric(db, f.id)
  })
})

async function saveBrand(page: Page, fields: { brand?: string; tagline?: string; whatsapp?: string; days?: string }) {
  await page.goto('/admin/settings/brand')
  if (fields.brand !== undefined) await page.getByLabel('Brand name').fill(fields.brand)
  if (fields.tagline !== undefined) await page.getByLabel('Tagline').fill(fields.tagline)
  if (fields.whatsapp !== undefined) await page.getByLabel('WhatsApp business number').fill(fields.whatsapp)
  if (fields.days !== undefined) await page.getByLabel('Days a sold product stays in listings').fill(fields.days)
  await page.getByRole('button', { name: 'Save' }).click()
}

test('settings home links every section', async ({ page }) => {
  await page.goto('/admin/settings')
  for (const name of ['Brand and WhatsApp', 'Categories and lists', 'Price bands', 'Page texts']) {
    await expect(page.getByRole('link', { name })).toBeVisible()
  }
})

test('brand name and tagline change the public header', async ({ page }) => {
  await saveBrand(page, { brand: 'Sari Sutra', tagline: 'Handpicked sarees from Hyderabad' })
  await expect(page.getByText('Saved.')).toBeVisible()
  await page.goto('/')
  await expect(page.getByRole('banner')).toContainText('Sari Sutra')
  // On phones the tagline shows in the home banner (the header has no room for it).
  await expect(page.getByTestId('hero')).toContainText('Handpicked sarees from Hyderabad')
})

test('the WhatsApp number accepts the ways people type it and rejects nonsense', async ({ page }) => {
  await saveBrand(page, { whatsapp: '98765 43210' })
  await expect(page.getByText('Saved.')).toBeVisible()
  await expect(page.getByLabel('WhatsApp business number')).toHaveValue('919876543210')
  await page.goto(SAREE_PATH)
  await expect(page.getByTestId('order-button')).toHaveAttribute('href', /^https:\/\/wa\.me\/919876543210\?text=/)

  await saveBrand(page, { whatsapp: '12345' })
  await expect(page.locator('form').getByRole('alert')).toHaveText('Enter a valid Indian mobile number.')
  await page.goto(SAREE_PATH)
  await expect(page.getByTestId('order-button')).toHaveAttribute('href', /^https:\/\/wa\.me\/919876543210\?text=/)
})

test('clearing the WhatsApp number hides every WhatsApp button on the site', async ({ page }) => {
  await saveBrand(page, { whatsapp: '' })
  await expect(page.getByText('Saved.')).toBeVisible()
  await page.goto(SAREE_PATH)
  await expect(page.getByTestId('order-button')).toHaveCount(0)
  await expect(page.getByTestId('whatsapp-fab')).toHaveCount(0)
  await expect(page.getByText('Ordering opens soon. Please check back.')).toBeVisible()
  await saveBrand(page, { whatsapp: SEED_WHATSAPP })
})

test('sold products leave listings after the configured number of days', async ({ page }) => {
  await saveBrand(page, { days: '0' })
  await page.goto('/new')
  await page.getByTestId('grid-end').scrollIntoViewIfNeeded()
  await expect(page.locator('a[data-testid="product-card"]', { hasText: 'Ruby Banarasi Silk Saree' })).toHaveCount(0)
  await saveBrand(page, { days: '7' })
  await page.goto('/new')
  await page.getByTestId('grid-end').scrollIntoViewIfNeeded()
  await expect(page.locator('a[data-testid="product-card"]', { hasText: 'Ruby Banarasi Silk Saree' })).toHaveCount(1)
})

test('banner and customer photos appear on the home page', async ({ page }) => {
  await page.goto('/admin/settings/brand')
  await page.getByTestId('banner-input').setInputFiles(fixture('big.jpg'))
  await expect(page.getByTestId('banner-preview')).toBeVisible({ timeout: 20_000 })
  await page.getByTestId('customer-input').setInputFiles(fixture('second.jpg'))
  await expect(page.getByTestId('customer-photo')).toHaveCount(1, { timeout: 20_000 })

  await page.goto('/')
  await expect(page.getByTestId('hero').locator('img')).toHaveAttribute('src', /^\/media\/site\//)
  await expect(page.getByTestId('customer-photos').locator('img')).toHaveCount(1)
})

test('a new category gets a home tile and appears in the product form', async ({ page }) => {
  await page.goto('/admin/settings/lists')
  await page.getByLabel('New category name').fill('Kurtis')
  await page.getByLabel('Code letters').fill('k')
  await page.getByRole('button', { name: 'Add category' }).click()
  await expect(page.getByTestId('category-row').filter({ hasText: 'Kurtis' })).toContainText('K')

  await page.goto('/')
  await expect(page.getByTestId('category-tiles').getByRole('link', { name: 'Kurtis' })).toBeVisible()
  await page.goto('/admin/products/new')
  await expect(page.getByTestId('category').locator('option', { hasText: 'Kurtis' })).toHaveCount(1)
})

test('a category in use cannot be deleted, and duplicates are refused', async ({ page }) => {
  await page.goto('/admin/settings/lists')
  page.once('dialog', (d) => void d.accept())
  await page.getByTestId('category-row').filter({ hasText: 'Sarees' }).getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByText('Sarees is used by products and cannot be deleted.')).toBeVisible()

  await page.getByLabel('New category name').fill('sarees')
  await page.getByLabel('Code letters').fill('X')
  await page.getByRole('button', { name: 'Add category' }).click()
  await expect(page.getByText('sarees already exists.')).toBeVisible()
})

test('a new fabric appears in the public filter', async ({ page }) => {
  await page.goto('/admin/settings/lists')
  await page.getByLabel('New fabric').fill('Organza')
  await page.getByRole('button', { name: 'Add fabric' }).click()
  await expect(page.getByTestId('fabric-row').filter({ hasText: 'Organza' })).toBeVisible()
  await page.goto('/c/sarees')
  await expect(page.getByLabel('Fabric').locator('option', { hasText: 'Organza' })).toHaveCount(1)
})

test('saving the price bands keeps existing /price links working', async ({ page }) => {
  await page.goto('/')
  const href = (await page.getByTestId('price-bands').getByRole('link').first().getAttribute('href'))!
  await page.goto('/admin/settings/bands')
  await page.getByTestId('band-row').first().getByLabel('Label').fill('Under ₹999 (edited)')
  await page.getByRole('button', { name: 'Save price bands' }).click()
  await expect(page.getByText('Saved.')).toBeVisible()
  const res = await page.goto(href)
  expect(res?.status()).toBe(200)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Under ₹999 (edited)')
})

test('a band added in this visit keeps its address when saved again', async ({ page, request }) => {
  await page.goto('/admin/settings/bands')
  await page.getByRole('button', { name: 'Add band' }).click()
  const added = page.getByTestId('band-row').last()
  await added.getByLabel('Label').fill('Luxury')
  await added.getByLabel('From (₹)').fill('9000')
  await page.getByRole('button', { name: 'Save price bands' }).click()
  await expect(page.getByText('Saved.')).toBeVisible()

  // Someone shares the new band's link now (read without leaving the editor).
  const home = await (await request.get('/')).text()
  const href = /href="(\/price\/\d+)"[^>]*>Luxury</.exec(home)![1]

  // The owner fixes the label and saves again, still on the same screen.
  await added.getByLabel('Label').fill('Luxury picks')
  await page.getByRole('button', { name: 'Save price bands' }).click()
  await expect(page.getByText('Saved.')).toBeVisible()

  const res = await request.get(href)
  expect(res.status()).toBe(200)
  expect(await res.text()).toContain('Luxury picks')

  // Later tests in this file start from the seeded three bands.
  withDb((db) => savePriceBands(db, SEED_BANDS))
})

test('replacing the price bands changes the home page', async ({ page }) => {
  await page.goto('/admin/settings/bands')
  const rows = page.getByTestId('band-row')
  await expect(rows).toHaveCount(3)
  await rows.nth(2).getByRole('button', { name: 'Remove band' }).click()
  await rows.nth(0).getByLabel('Label').fill('Budget picks')
  await rows.nth(0).getByLabel('Up to (₹)').fill('1499')
  await rows.nth(1).getByLabel('Label').fill('Premium')
  await rows.nth(1).getByLabel('From (₹)').fill('1500')
  await rows.nth(1).getByLabel('Up to (₹)').fill('')
  await page.getByRole('button', { name: 'Save price bands' }).click()
  await expect(page.getByText('Saved.')).toBeVisible()

  await page.goto('/')
  await expect(page.getByTestId('price-bands').getByRole('link')).toHaveText(['Budget picks', 'Premium'])
})

test('editing the About text changes the public page', async ({ page }) => {
  await page.goto('/admin/settings/pages')
  const about = page.getByTestId('page-about')
  await about.getByLabel('Text').fill('We started selling sarees on WhatsApp in 2019.\n\nNow we have a website.')
  await about.getByRole('button', { name: 'Save' }).click()
  await expect(about.getByText('Saved.')).toBeVisible()
  await page.goto('/about')
  await expect(page.getByText('We started selling sarees on WhatsApp in 2019.')).toBeVisible()
  await expect(page.getByText('Now we have a website.')).toBeVisible()
})

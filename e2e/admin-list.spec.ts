import { expect, test } from '@playwright/test'
import { E2E_SITE_URL } from '../playwright.config'
import { formatPrice } from '../src/lib/format'
import { seedCode, seedProduct, SEED_PRODUCTS } from '../scripts/seed-catalogue'
import { addProduct, findPublic, signInAsOwner, uniqueName } from './helpers'

test.use({ permissions: ['clipboard-read', 'clipboard-write'] })

test.beforeEach(async ({ page }) => {
  await signInAsOwner(page)
})

test('the list shows cover, name, code, price and status', async ({ page }) => {
  const name = 'Emerald Banarasi Saree'
  await page.goto('/admin/products')
  const row = page.getByTestId(`row-${seedCode(name)}`)
  await expect(row).toContainText(name)
  await expect(row).toContainText(seedCode(name))
  await expect(row).toContainText(formatPrice(seedProduct(name).price))
  await expect(row).toContainText('Available')
  await expect(row.locator('img')).toHaveAttribute('src', /\/media\/.+\.webp$/)
})

test('status tabs filter the list', async ({ page }) => {
  await page.goto('/admin/products')
  await page.getByRole('link', { name: /^Sold/ }).click()
  await expect(page).toHaveURL(/status=sold/)
  const rows = page.locator('[data-testid^="row-"]')
  await expect(rows.first()).toContainText('Sold')
  expect(await rows.count()).toBeGreaterThanOrEqual(SEED_PRODUCTS.filter((p) => typeof p.state === 'object').length)
  for (const text of await rows.allInnerTexts()) expect(text).toContain('Sold')

  await page.getByRole('link', { name: /^Drafts/ }).click()
  await expect(page).toHaveURL(/status=draft/)
  await expect(rows.first()).toContainText('Draft')
  for (const text of await rows.allInnerTexts()) expect(text).toContain('Draft')
})

test('searching a code shows exactly that product', async ({ page }) => {
  await page.goto('/admin/products')
  const code = seedCode('Coral Georgette Saree')
  await page.getByRole('searchbox', { name: 'Search products' }).fill(code.toLowerCase())
  await page.getByRole('searchbox', { name: 'Search products' }).press('Enter')
  await expect(page.locator('[data-testid^="row-"]')).toHaveCount(1)
  await expect(page.getByTestId(`row-${code}`)).toBeVisible()
})

test('mark sold and mark available again, one tap each, reflected on the public page', async ({ page, request }) => {
  const card = await addProduct(page, request, uniqueName('Sell Me'))
  await page.goto('/admin/products')
  const row = page.getByTestId(`row-${card.code}`)
  await row.getByTestId('mark-sold').click()
  await expect(row).toContainText('Sold')
  await page.goto(card.path)
  await expect(page.getByTestId('sold-label')).toBeVisible()
  await expect(page.getByTestId('order-button')).toHaveCount(0)

  await page.goto('/admin/products')
  await page.getByTestId(`row-${card.code}`).getByTestId('mark-available').click()
  await expect(page.getByTestId(`row-${card.code}`)).toContainText('Available')
  await page.goto(card.path)
  await expect(page.getByTestId('order-button')).toBeVisible()
})

test('duplicate opens a new draft copy without photos and with a new code', async ({ page, request }) => {
  const name = uniqueName('Copy Source')
  const card = await addProduct(page, request, name)
  await page.goto('/admin/products')
  const row = page.getByTestId(`row-${card.code}`)
  await row.getByRole('button', { name: 'More actions' }).click()
  await row.getByTestId('duplicate').click()
  await expect(page).toHaveURL(/\/admin\/products\/\d+$/)
  await expect(page.getByTestId('name')).toHaveValue(`${name} (copy)`)
  await expect(page.locator('[data-testid^="photo-"][data-status]')).toHaveCount(0)
  await expect(page.getByText('Draft', { exact: false }).first()).toBeVisible()
  await expect(page.getByRole('heading', { level: 1 })).not.toContainText(card.code)
})

test('delete asks first, then removes the product everywhere', async ({ page, request }) => {
  const card = await addProduct(page, request, uniqueName('Delete Me'))
  await page.goto('/admin/products')
  const row = page.getByTestId(`row-${card.code}`)
  page.once('dialog', (d) => {
    expect(d.message()).toBe('Delete this product? This cannot be undone.')
    void d.accept()
  })
  await row.getByRole('button', { name: 'More actions' }).click()
  await row.getByTestId('delete').click()
  await expect(page.getByTestId(`row-${card.code}`)).toHaveCount(0)
  const res = await page.goto(card.path)
  expect(res?.status()).toBe(404)
  expect(await findPublic(request, card.name)).toHaveLength(0)
})

test('dismissing the delete question keeps the product', async ({ page, request }) => {
  const card = await addProduct(page, request, uniqueName('Keep Me'))
  await page.goto('/admin/products')
  const row = page.getByTestId(`row-${card.code}`)
  page.once('dialog', (d) => void d.dismiss())
  await row.getByRole('button', { name: 'More actions' }).click()
  await row.getByTestId('delete').click()
  await page.reload()
  await expect(page.getByTestId(`row-${card.code}`)).toBeVisible()
})

test('copy link puts the public address on the clipboard', async ({ page }) => {
  const code = seedCode('Teal Banarasi Saree')
  await page.goto('/admin/products')
  const row = page.getByTestId(`row-${code}`)
  await row.getByRole('button', { name: 'More actions' }).click()
  await row.getByTestId('copy-link').click()
  await expect(row.getByTestId('copy-link')).toContainText('Copied')
  const text = await page.evaluate(() => navigator.clipboard.readText())
  expect(text).toBe(`${E2E_SITE_URL}/p/${code.toLowerCase()}-teal-banarasi-saree`)
})

test('bottom navigation reaches products, add and settings', async ({ page }) => {
  await page.goto('/admin')
  const nav = page.getByRole('navigation', { name: 'Admin' })
  await expect(nav.getByRole('link', { name: 'Products' })).toHaveAttribute('href', '/admin/products')
  await expect(nav.getByRole('link', { name: 'Add' })).toHaveAttribute('href', '/admin/products/new')
  await expect(nav.getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/admin/settings')
})

import { expect, test, type Page } from '@playwright/test'
import { findPublic, fixture, signInAsOwner, uniqueName } from './helpers'

const BIG = fixture('big.jpg') // 2000×2600
const SECOND = fixture('second.jpg') // 1600×2133
const SMALL = fixture('small.jpg') // 800×1000, below the 1200 px warning limit
const PDF = fixture('not-an-image.pdf')

async function waitForUploads(page: Page, count: number) {
  await expect(page.locator('[data-testid^="photo-"][data-status="done"]')).toHaveCount(count, { timeout: 30_000 })
}

test.beforeEach(async ({ page }) => {
  await signInAsOwner(page)
})

test('add a product with two photos, see the margin, publish it, find it on the site', async ({ page, request }) => {
  const name = uniqueName('Test Teal Cotton')
  await page.goto('/admin/products/new')
  await page.getByTestId('photo-input').setInputFiles([BIG, SMALL])
  await waitForUploads(page, 2)
  await expect(page.getByTestId('photo-0').getByTestId('lowres-warning')).toHaveCount(0)
  await expect(page.getByTestId('photo-1').getByTestId('lowres-warning')).toBeVisible()

  await page.getByTestId('name').fill(name)
  await page.getByTestId('price').fill('1450')
  await page.getByTestId('category').selectOption({ label: 'Sarees' })
  await page.getByTestId('dealer-price').fill('1100')
  await expect(page.getByTestId('margin')).toContainText('₹350')
  await page.getByTestId('publish').click()

  await expect(page).toHaveURL(/\/admin\/products$/)
  await expect(page.getByText(name)).toBeVisible()

  const [found] = await findPublic(request, name)
  expect(found.price).toBe(1450)
  await page.goto(found.path)
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
  await expect(page.getByTestId('gallery').locator('img')).toHaveCount(2)
  const html = await page.content()
  expect(html).not.toMatch(/\b1100\b/)
  expect(html).not.toContain('₹1,100')
})

test('"Make cover" moves a photo first, and the public cover follows', async ({ page, request }) => {
  const name = uniqueName('Cover Test')
  await page.goto('/admin/products/new')
  await page.getByTestId('photo-input').setInputFiles([BIG, SECOND])
  await waitForUploads(page, 2)
  const secondSrc = await page.getByTestId('photo-1').locator('img').getAttribute('data-media-path')
  await page.getByTestId('photo-1').getByRole('button', { name: 'Make cover' }).click()
  await expect(page.getByTestId('photo-0').locator('img')).toHaveAttribute('data-media-path', secondSrc!)

  await page.getByTestId('name').fill(name)
  await page.getByTestId('price').fill('999')
  await page.getByTestId('publish').click()
  await expect(page).toHaveURL(/\/admin\/products$/)

  const [found] = await findPublic(request, name)
  await page.goto(found.path)
  const hash = secondSrc!.split('/')[1].split('-')[0]
  await expect(page.getByTestId('gallery').locator('img').first()).toHaveAttribute('src', new RegExp(hash))
})

test('an unsupported file is refused on its own; the other photo still uploads and publishes', async ({ page, request }) => {
  const name = uniqueName('Mixed Upload')
  await page.goto('/admin/products/new')
  await page.getByTestId('photo-input').setInputFiles([BIG, PDF])
  await waitForUploads(page, 1)
  const failed = page.locator('[data-testid^="photo-"][data-status="failed"]')
  await expect(failed).toContainText('This file type is not supported. Use JPEG, PNG or WebP photos, or MP4 video.')
  await expect(failed).toContainText('not-an-image.pdf')
  await expect(failed.locator('img')).toHaveCount(0) // no broken preview
  await expect(failed.getByRole('button', { name: 'Retry' })).toHaveCount(0) // retrying cannot help
  await failed.getByRole('button', { name: 'Remove' }).click()
  await expect(failed).toHaveCount(0)

  await page.getByTestId('name').fill(name)
  await page.getByTestId('price').fill('1200')
  await page.getByTestId('publish').click()
  await expect(page).toHaveURL(/\/admin\/products$/)
  expect(await findPublic(request, name)).toHaveLength(1)
})

test('publishing without a photo explains why and keeps what was typed', async ({ page }) => {
  await page.goto('/admin/products/new')
  await page.getByTestId('name').fill('No Photo Yet')
  await page.getByTestId('price').fill('1500')
  await page.getByTestId('dealer-price').fill('1000')
  await page.getByTestId('publish').click()
  await expect(page.getByTestId('form-errors')).toContainText('Add at least one photo.')
  await expect(page).toHaveURL(/\/admin\/products\/new/)
  await expect(page.getByTestId('name')).toHaveValue('No Photo Yet')
  await expect(page.getByTestId('price')).toHaveValue('1500')
  await expect(page.getByTestId('dealer-price')).toHaveValue('1000')
})

test('a draft with only name, price and category is saved but not public', async ({ page, request }) => {
  const name = uniqueName('Draft Only')
  await page.goto('/admin/products/new')
  await page.getByTestId('name').fill(name)
  await page.getByTestId('price').fill('800')
  await page.getByTestId('save-draft').click()
  await expect(page).toHaveURL(/\/admin\/products$/)
  await expect(page.getByText(name)).toBeVisible()
  expect(await findPublic(request, name)).toHaveLength(0)
})

test('double-tapping Publish creates exactly one product', async ({ page, request }) => {
  const name = uniqueName('Double Tap')
  await page.goto('/admin/products/new')
  await page.getByTestId('photo-input').setInputFiles([BIG])
  await waitForUploads(page, 1)
  await page.getByTestId('name').fill(name)
  await page.getByTestId('price').fill('1300')
  await page.getByTestId('publish').dblclick()
  await expect(page).toHaveURL(/\/admin\/products$/)
  expect(await findPublic(request, name)).toHaveLength(1)
})

test('editing the price shows on the public page at once', async ({ page, request }) => {
  const name = uniqueName('Edit Price')
  await page.goto('/admin/products/new')
  await page.getByTestId('photo-input').setInputFiles([SECOND])
  await waitForUploads(page, 1)
  await page.getByTestId('name').fill(name)
  await page.getByTestId('price').fill('2000')
  await page.getByTestId('publish').click()
  await expect(page).toHaveURL(/\/admin\/products$/)

  await page.getByRole('link', { name }).click()
  await expect(page).toHaveURL(/\/admin\/products\/\d+$/)
  await expect(page.getByTestId('photo-0')).toHaveAttribute('data-status', 'done')
  await page.getByTestId('price').fill('2100')
  await page.getByTestId('save').click()
  await expect(page).toHaveURL(/\/admin\/products$/)

  const [found] = await findPublic(request, name)
  await page.goto(found.path)
  await expect(page.getByTestId('price')).toHaveText('₹2,100')
})

test('"Fill for me" fills empty fields from the dealer message and keeps what was typed', async ({ page }) => {
  // The e2e server runs with AUTOFILL_FAKE=1: a built-in stand-in answers instead of the Claude API.
  await page.goto('/admin/products/new')
  await page.getByLabel('Description').fill('My own words.')
  await page.getByLabel("Dealer's message").fill('Peacock blue soft silk, 6.3 m with blouse. Rate 1850. Contact Ravi 98xxxxxx')
  await page.getByRole('button', { name: 'Fill for me' }).click()
  await expect(page.getByTestId('name')).toHaveValue('Peacock Blue Soft Silk Saree')
  await expect(page.getByTestId('dealer-price')).toHaveValue('1850')
  await expect(page.getByLabel('Description')).toHaveValue('My own words.')
  await expect(page.getByTestId('price')).toHaveValue('')
  await expect(page.getByTestId('margin')).toHaveCount(0)
})

test('"Fill for me" refuses without a session', async ({ playwright, baseURL }) => {
  const anon = await playwright.request.newContext({ baseURL })
  const res = await anon.post('/admin/autofill', { data: { text: 'Soft silk saree' } })
  expect(res.status()).toBe(401)
  await anon.dispose()
})

test('uploading without a session is refused', async ({ playwright }) => {
  const anon = await playwright.request.newContext({ baseURL: test.info().project.use.baseURL })
  const res = await anon.post('/admin/upload', { multipart: { batchId: 'abcdefgh-1234', file: { name: 'x.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('x') } } })
  expect(res.status()).toBe(401)
  await anon.dispose()
})

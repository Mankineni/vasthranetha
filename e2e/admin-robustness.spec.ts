// What phones really do: go Back after saving, lose the connection, pick huge files,
// and name products in Telugu with emoji.
import { expect, test } from '@playwright/test'
import { E2E_SITE_URL } from '../playwright.config'
import { SEED_WHATSAPP } from '../scripts/seed-catalogue'
import { buildOrderMessage } from '../src/lib/whatsapp/message'
import { findPublic, fixture, signInAsOwner, uniqueName } from './helpers'

const MB = 1024 * 1024
const done = '[data-testid^="photo-"][data-status="done"]'

test.beforeEach(async ({ page }) => {
  await signInAsOwner(page)
})

test('save a draft, go Back, type a second product: both are kept', async ({ page }) => {
  const first = uniqueName('Back First')
  const second = uniqueName('Back Second')
  await page.goto('/admin/products/new')
  await page.getByTestId('name').fill(first)
  await page.getByTestId('price').fill('900')
  await page.getByTestId('save-draft').click()
  await expect(page).toHaveURL(/\/admin\/products$/)

  await page.goBack()
  await expect(page).toHaveURL(/\/admin\/products\/new$/)
  await page.getByTestId('name').fill(second)
  await page.getByTestId('price').fill('950')
  await page.getByTestId('save-draft').click()
  await expect(page).toHaveURL(/\/admin\/products$/)

  await page.goto('/admin/products?status=draft')
  await expect(page.getByRole('link', { name: first })).toBeVisible()
  await expect(page.getByRole('link', { name: second })).toBeVisible()
})

test('Back after editing shows the saved values, so saving again cannot undo the edit', async ({ page, request }) => {
  const name = uniqueName('Back Edit')
  await page.goto('/admin/products/new')
  await page.getByTestId('photo-input').setInputFiles([fixture('second.jpg')])
  await expect(page.locator(done)).toHaveCount(1, { timeout: 30_000 })
  await page.getByTestId('name').fill(name)
  await page.getByTestId('price').fill('2000')
  await page.getByTestId('publish').click()
  await expect(page).toHaveURL(/\/admin\/products$/)

  await page.getByRole('link', { name }).click()
  await expect(page).toHaveURL(/\/admin\/products\/\d+$/)
  await page.getByTestId('price').fill('2345')
  await page.getByTestId('save').click()
  await expect(page).toHaveURL(/\/admin\/products$/)

  await page.goBack()
  await expect(page).toHaveURL(/\/admin\/products\/\d+$/)
  await expect(page.getByTestId('price')).toHaveValue('2345')
  await page.getByTestId('save').click()
  await expect(page).toHaveURL(/\/admin\/products$/)
  const [card] = await findPublic(request, name)
  expect(card.price).toBe(2345)
})

test('the settings image upload refuses an oversized body without reading it', async ({ page }) => {
  const res = await page.request.post('/admin/site-image', {
    multipart: { target: 'banner', file: { name: 'huge.jpg', mimeType: 'image/jpeg', buffer: Buffer.alloc(27 * MB) } },
  })
  expect(res.status()).toBe(413)
})

test('a save that fails on a lost connection keeps everything typed and says what happened', async ({ page, context }) => {
  await page.goto('/admin/products/new')
  await page.getByTestId('photo-input').setInputFiles([fixture('second.jpg')])
  await expect(page.locator(done)).toHaveCount(1, { timeout: 30_000 })
  await page.getByTestId('name').fill('Offline Saree')
  await page.getByTestId('price').fill('1999')
  await page.getByTestId('dealer-price').fill('1500')

  await context.setOffline(true)
  await page.getByTestId('publish').click()
  await expect(page.getByTestId('form-errors')).toContainText('Could not save. Check your connection and try again.')
  await expect(page.getByTestId('name')).toHaveValue('Offline Saree')
  await expect(page.getByTestId('price')).toHaveValue('1999')
  await expect(page.getByTestId('dealer-price')).toHaveValue('1500')
  await expect(page.locator(done)).toHaveCount(1)

  await context.setOffline(false)
  await page.getByTestId('publish').click()
  await expect(page).toHaveURL(/\/admin\/products$/)
  await expect(page.getByText('Offline Saree')).toBeVisible()
})

test('files over the size limit are refused on the phone, before any upload, with the right reason', async ({ page }) => {
  const uploads: string[] = []
  page.on('request', (r) => {
    if (r.url().endsWith('/admin/upload')) uploads.push(r.url())
  })
  await page.goto('/admin/products/new')
  const jpegHeader = Buffer.from([0xff, 0xd8, 0xff, 0xe0])
  await page.getByTestId('photo-input').setInputFiles([
    { name: 'huge-photo.jpg', mimeType: 'image/jpeg', buffer: Buffer.concat([jpegHeader, Buffer.alloc(26 * MB)]) },
    { name: 'long-video.mp4', mimeType: 'video/mp4', buffer: Buffer.alloc(21 * MB) },
  ])
  const failed = page.locator('[data-testid^="photo-"][data-status="failed"]')
  await expect(failed).toHaveCount(2)
  await expect(failed.filter({ hasText: 'huge-photo.jpg' })).toContainText('Photo is larger than 25 MB.')
  await expect(failed.filter({ hasText: 'long-video.mp4' })).toContainText('Video is larger than 20 MB.')
  await expect(failed.getByRole('button', { name: 'Retry' })).toHaveCount(0)
  expect(uploads).toEqual([])
})

test('the upload endpoint refuses an oversized body without reading it', async ({ page }) => {
  const res = await page.request.post('/admin/upload', {
    multipart: {
      batchId: 'abcdefgh-1234',
      file: { name: 'huge.jpg', mimeType: 'image/jpeg', buffer: Buffer.alloc(27 * MB) },
    },
  })
  expect(res.status()).toBe(413)
  expect((await res.json()).error).toBe('This file is too large. Photos can be up to 25 MB and videos up to 20 MB.')
})

for (const [label, base] of [
  ['Telugu, emoji and symbols', 'పట్టు చీర 🌸 Red & Gold #1'],
  ['only Telugu and emoji (no English letters for the address)', 'పట్టు చీర 🌸'],
] as const) {
  test(`a product named in ${label} gets a working page and an intact WhatsApp message`, async ({ page, request }) => {
    const name = `${base} ${Date.now().toString(36)}`
    await page.goto('/admin/products/new')
    await page.getByTestId('photo-input').setInputFiles([fixture('second.jpg')])
    await expect(page.locator(done)).toHaveCount(1, { timeout: 30_000 })
    await page.getByTestId('name').fill(name)
    await page.getByTestId('price').fill('2100')
    await page.getByTestId('publish').click()
    await expect(page).toHaveURL(/\/admin\/products$/)

    const [card] = await findPublic(request, name)
    expect(card.path).toMatch(/^\/p\/[a-z]{1,3}-\d+(-[a-z0-9-]+)?$/)
    const res = await page.goto(card.path)
    expect(res?.status()).toBe(200)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(name)
    const href = (await page.getByTestId('order-button').getAttribute('href'))!
    expect(href.startsWith(`https://wa.me/${SEED_WHATSAPP}?text=`)).toBe(true)
    expect(new URL(href).searchParams.get('text')).toBe(
      buildOrderMessage({ name, code: card.code, price: 2100, url: E2E_SITE_URL + card.path }),
    )
  })
}

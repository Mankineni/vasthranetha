import { expect, test } from '@playwright/test'
import { SEED_WHATSAPP } from '../scripts/seed-catalogue'
import { updateSettings } from '../src/lib/settings/settings'
import { withDb } from './db'
import { addProduct, signInAsOwner, uniqueName } from './helpers'

test.afterAll(() => withDb((db) => updateSettings(db, { whatsappNumber: SEED_WHATSAPP })))

test('views and order taps show up on the admin home', async ({ page, context, request }) => {
  await signInAsOwner(page)
  const name = uniqueName('Counted')
  const card = await addProduct(page, request, name)
  // Order links open WhatsApp in a new tab; answer them locally instead.
  await context.route('https://wa.me/**', (route) => route.fulfill({ status: 200, body: 'WhatsApp' }))

  for (let i = 0; i < 3; i++) {
    const beacon = page.waitForRequest((r) => r.url().endsWith('/api/event') && r.postData()?.includes('"view"') === true)
    await page.goto(card.path)
    await beacon
  }
  const tap = page.waitForRequest((r) => r.url().endsWith('/api/event') && r.postData()?.includes('order_tap') === true)
  const popup = page.waitForEvent('popup')
  await page.getByTestId('order-button').click()
  await tap
  await (await popup).close()

  await page.goto('/admin')
  await expect(page.getByTestId('top-viewed').getByRole('listitem').filter({ hasText: name })).toContainText('3')
  await expect(page.getByTestId('top-taps').getByRole('listitem').filter({ hasText: name })).toContainText('1')
  await expect(page.getByTestId('stat-live')).toBeVisible()
  await expect(page.getByTestId('stat-added')).not.toHaveText('0')
})

test('the event endpoint answers 204 and sets no cookie', async ({ request }) => {
  const res = await request.post('/api/event', { data: { code: 'S-1001', type: 'view' } })
  expect(res.status()).toBe(204)
  expect(res.headers()['set-cookie']).toBeUndefined()
  const junk = await request.post('/api/event', { data: 'not json', headers: { 'content-type': 'text/plain' } })
  expect(junk.status()).toBe(204)
})

test('the admin home warns when the WhatsApp number is missing', async ({ page }) => {
  withDb((db) => updateSettings(db, { whatsappNumber: null }))
  await signInAsOwner(page)
  await expect(page.getByText('WhatsApp number is not set. Order buttons are hidden.')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Set the number' })).toHaveAttribute('href', '/admin/settings/brand')
  withDb((db) => updateSettings(db, { whatsappNumber: SEED_WHATSAPP }))
  await page.reload()
  await expect(page.getByText('WhatsApp number is not set. Order buttons are hidden.')).toHaveCount(0)
})

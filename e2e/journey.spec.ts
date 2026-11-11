import { expect, test } from '@playwright/test'
import { E2E_SITE_URL } from '../playwright.config'
import { SEED_WHATSAPP } from '../scripts/seed-catalogue'
import { buildOrderMessage } from '../src/lib/whatsapp/message'
import { fixture, signInAsOwner, uniqueName } from './helpers'

test('owner adds a saree, a customer finds and orders it, the owner marks it sold', async ({ page, browser }) => {
  // Owner, on the phone: two photos, a name and a price, Publish.
  await signInAsOwner(page)
  const name = uniqueName('Journey Kanchi Silk')
  await page.goto('/admin/products/new')
  await page.getByTestId('photo-input').setInputFiles([fixture('big.jpg'), fixture('second.jpg')])
  await expect(page.locator('[data-testid^="photo-"][data-status="done"]')).toHaveCount(2, { timeout: 30_000 })
  await page.getByTestId('name').fill(name)
  await page.getByTestId('price').fill('2750')
  await page.getByTestId('publish').click()
  await expect(page).toHaveURL(/\/admin\/products$/)

  // Customer, in a separate browser session: New arrivals → the product → order on WhatsApp.
  const customer = await browser.newContext({ ...test.info().project.use })
  const shop = await customer.newPage()
  await shop.goto('/')
  await shop.getByRole('link', { name: 'New arrivals' }).first().click()
  await expect(shop).toHaveURL(/\/new$/)
  await shop.locator('a[data-testid="product-card"]', { hasText: name }).click()
  await expect(shop.getByRole('heading', { level: 1, name })).toBeVisible()
  await expect(shop.getByTestId('gallery').locator('img')).toHaveCount(2)
  const code = (await shop.getByText(/^Code: /).textContent())!.replace('Code: ', '').trim()
  const href = (await shop.getByTestId('order-button').getAttribute('href'))!
  expect(href.startsWith(`https://wa.me/${SEED_WHATSAPP}?text=`)).toBe(true)
  expect(new URL(href).searchParams.get('text')).toBe(
    buildOrderMessage({ name, code, price: 2750, url: E2E_SITE_URL + new URL(shop.url()).pathname }),
  )

  // Owner confirms with the dealer and the customer pays: one tap marks it sold.
  await page.goto('/admin/products')
  await page.getByTestId(`row-${code}`).getByTestId('mark-sold').click()
  await expect(page.getByTestId(`row-${code}`)).toContainText('Sold')

  // The customer's page now says Sold and offers something similar instead.
  await shop.reload()
  await expect(shop.getByTestId('sold-label')).toBeVisible()
  await expect(shop.getByTestId('order-button')).toHaveCount(0)
  await expect(shop.getByRole('link', { name: 'Ask for something similar on WhatsApp' })).toBeVisible()
  await customer.close()
})

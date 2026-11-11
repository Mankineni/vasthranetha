import path from 'node:path'
import { expect, type APIRequestContext, type Page } from '@playwright/test'
import { E2E_OWNER } from '../scripts/e2e-owner'

export { E2E_OWNER }

export const fixture = (name: string) => path.join(__dirname, '..', 'tests', 'fixtures', name)

let seq = 0
export const uniqueName = (base: string) => `${base} ${Date.now().toString(36)}${seq++}`

export async function findPublic(request: APIRequestContext, name: string) {
  const res = await request.get(`/api/products?q=${encodeURIComponent(name)}`)
  return (await res.json()).items as { code: string; path: string; name: string; price: number; sold: boolean }[]
}

/** Adds and publishes a product through the form (signed in already); returns its public card. */
export async function addProduct(page: Page, request: APIRequestContext, name: string, price = 1500) {
  await page.goto('/admin/products/new')
  await page.getByTestId('photo-input').setInputFiles([fixture('second.jpg')])
  await expect(page.locator('[data-testid^="photo-"][data-status="done"]')).toHaveCount(1, { timeout: 30_000 })
  await page.getByTestId('name').fill(name)
  await page.getByTestId('price').fill(String(price))
  await page.getByTestId('publish').click()
  await expect(page).toHaveURL(/\/admin\/products$/)
  const [card] = await findPublic(request, name)
  return card
}

export async function signInAsOwner(page: Page, next?: string): Promise<void> {
  await page.goto(next ? `/admin/login?next=${encodeURIComponent(next)}` : '/admin/login')
  await page.getByLabel('Email or phone').fill(E2E_OWNER.login)
  await page.getByLabel('Password').fill(E2E_OWNER.password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).not.toHaveURL(/\/admin\/login/)
}

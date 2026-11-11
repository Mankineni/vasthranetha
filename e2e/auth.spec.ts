import { expect, test } from '@playwright/test'
import { E2E_OWNER, signInAsOwner } from './helpers'

test('admin redirects to sign-in when signed out', async ({ page }) => {
  await page.goto('/admin')
  await expect(page).toHaveURL(/\/admin\/login$/)
  await expect(page.getByRole('heading', { name: 'Owner sign-in' })).toBeVisible()
})

test('signing in lands on the admin home', async ({ page }) => {
  await signInAsOwner(page)
  await expect(page).toHaveURL(/\/admin$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Admin' })).toBeVisible()
  await expect(page.getByText(`Signed in as ${E2E_OWNER.name}`)).toBeVisible()
})

test('a wrong password shows a clear message and keeps the login typed', async ({ page }) => {
  await page.goto('/admin/login')
  await page.getByLabel('Email or phone').fill(E2E_OWNER.login)
  await page.getByLabel('Password').fill('not-the-password')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.locator('form').getByRole('alert')).toHaveText('Wrong login or password.')
  await expect(page.getByLabel('Email or phone')).toHaveValue(E2E_OWNER.login)
})

test('signing out ends the session', async ({ page }) => {
  await signInAsOwner(page)
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page).toHaveURL(/\/admin\/login$/)
  await page.goto('/admin')
  await expect(page).toHaveURL(/\/admin\/login$/)
})

test('the session cookie is http-only', async ({ page, context }) => {
  await signInAsOwner(page)
  const cookie = (await context.cookies()).find((c) => c.name === 'bq_session')
  expect(cookie?.httpOnly).toBe(true)
  expect(cookie?.sameSite).toBe('Lax')
  expect(await page.evaluate(() => document.cookie)).not.toContain('bq_session')
})

test('sign-in only redirects to admin addresses', async ({ page }) => {
  await signInAsOwner(page, 'https://evil.example/steal')
  await expect(page).toHaveURL(/\/admin$/)
})

test('admin pages are not cached and not indexed', async ({ page }) => {
  const res = await page.goto('/admin/login')
  expect(res?.status()).toBe(200)
  expect(res?.headers()['cache-control']).toContain('no-store')
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/)
  await signInAsOwner(page)
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/)
})

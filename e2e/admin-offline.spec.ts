// Every admin form keeps what was typed, and says what happened, when the connection drops.
import { expect, test } from '@playwright/test'
import { E2E_OWNER, signInAsOwner } from './helpers'

const LOST = 'Could not save. Check your connection and try again.'

test('page texts', async ({ page, context }) => {
  await signInAsOwner(page)
  await page.goto('/admin/settings/pages')
  const about = page.getByTestId('page-about')
  await about.getByLabel('Text').fill('Typed while the signal dropped.')
  await context.setOffline(true)
  await about.getByRole('button', { name: 'Save' }).click()
  await expect(about.getByRole('alert')).toHaveText(LOST)
  await expect(about.getByLabel('Text')).toHaveValue('Typed while the signal dropped.')
  await context.setOffline(false)
})

test('brand and WhatsApp', async ({ page, context }) => {
  await signInAsOwner(page)
  await page.goto('/admin/settings/brand')
  await page.getByLabel('Tagline').fill('Typed offline tagline')
  await context.setOffline(true)
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.locator('form').getByRole('alert')).toHaveText(LOST)
  await expect(page.getByLabel('Tagline')).toHaveValue('Typed offline tagline')
  await context.setOffline(false)
})

test('new category', async ({ page, context }) => {
  await signInAsOwner(page)
  await page.goto('/admin/settings/lists')
  await page.getByLabel('New category name').fill('Offline Kurtis')
  await page.getByLabel('Code letters').fill('Q')
  await context.setOffline(true)
  await page.getByRole('button', { name: 'Add category' }).click()
  await expect(page.getByText(LOST)).toBeVisible()
  await expect(page.getByLabel('New category name')).toHaveValue('Offline Kurtis')
  await context.setOffline(false)
})

test('price bands', async ({ page, context }) => {
  await signInAsOwner(page)
  await page.goto('/admin/settings/bands')
  await page.getByTestId('band-row').first().getByLabel('Label').fill('Typed offline band')
  await context.setOffline(true)
  await page.getByRole('button', { name: 'Save price bands' }).click()
  await expect(page.getByText(LOST)).toBeVisible()
  await expect(page.getByTestId('band-row').first().getByLabel('Label')).toHaveValue('Typed offline band')
  await context.setOffline(false)
})

test('one-tap product actions show a message instead of an error page', async ({ page, context }) => {
  await signInAsOwner(page)
  await page.goto('/admin/products?status=available')
  const row = page.locator('[data-testid^="row-"]').first()
  await context.setOffline(true)
  await row.getByTestId('mark-sold').click()
  await expect(row).toContainText(LOST)
  await expect(page.getByRole('heading', { level: 1, name: 'Products' })).toBeVisible()
  await context.setOffline(false)
})

test('sign-in', async ({ page, context }) => {
  await page.goto('/admin/login')
  await page.getByLabel('Email or phone').fill(E2E_OWNER.login)
  await page.getByLabel('Password').fill(E2E_OWNER.password)
  await context.setOffline(true)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.locator('form').getByRole('alert')).toHaveText('Could not reach the site. Check your connection and try again.')
  await expect(page.getByLabel('Email or phone')).toHaveValue(E2E_OWNER.login)
  await context.setOffline(false)
})

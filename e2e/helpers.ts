import { expect, type Page } from '@playwright/test'
import { E2E_OWNER } from '../scripts/e2e-owner'

export { E2E_OWNER }

export async function signInAsOwner(page: Page, next?: string): Promise<void> {
  await page.goto(next ? `/admin/login?next=${encodeURIComponent(next)}` : '/admin/login')
  await page.getByLabel('Email or phone').fill(E2E_OWNER.login)
  await page.getByLabel('Password').fill(E2E_OWNER.password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).not.toHaveURL(/\/admin\/login/)
}

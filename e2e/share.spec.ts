import fs from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import { E2E_OWNER, fixture, signInAsOwner } from './helpers'

const BIG = fixture('big.jpg')
const SECOND = fixture('second.jpg')
const PDF = fixture('not-an-image.pdf')

function shareForm(paths: string[]) {
  const form = new FormData()
  for (const p of paths) {
    const type = p.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'
    form.append('files', new Blob([fs.readFileSync(p)], { type }), p.split(/[\\/]/).pop())
  }
  return form
}

/** Waits until the admin service worker is active, as on a phone after installing the app. */
async function waitForServiceWorker(page: Page) {
  await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready
    return reg.active?.state
  })
}

/** Submits a multipart POST navigation to the share target, like Android does after "Share". */
async function shareLikeAndroid(page: Page, paths: string[]) {
  await page.evaluate(() => {
    const form = document.createElement('form')
    form.method = 'post'
    form.action = '/admin/share'
    form.enctype = 'multipart/form-data'
    form.id = 'share-test'
    const input = document.createElement('input')
    input.type = 'file'
    input.name = 'files'
    input.multiple = true
    form.appendChild(input)
    document.body.appendChild(form)
  })
  await page.setInputFiles('#share-test input', paths)
  await page.evaluate(() => (document.getElementById('share-test') as HTMLFormElement).submit())
}

test('the admin manifest declares the share target and stays inside /admin', async ({ request }) => {
  const res = await request.get('/admin/manifest.webmanifest')
  expect(res.status()).toBe(200)
  expect(res.headers()['content-type']).toContain('application/manifest+json')
  const m = await res.json()
  expect(m).toMatchObject({ start_url: '/admin', scope: '/admin', id: '/admin', display: 'standalone' })
  expect(m.name).toMatch(/Admin$/)
  expect(m.share_target).toEqual({
    action: '/admin/share',
    method: 'POST',
    enctype: 'multipart/form-data',
    params: { files: [{ name: 'files', accept: ['image/*', 'video/mp4'] }] },
  })
  expect(m.icons.map((i: { sizes: string }) => i.sizes)).toEqual(['192x192', '512x512', '512x512'])
  expect(m.icons[2].purpose).toBe('maskable')
  for (const icon of m.icons) {
    const img = await request.get(icon.src)
    expect(img.status()).toBe(200)
    expect(img.headers()['content-type']).toBe('image/png')
  }
})

test('only admin pages link the manifest', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('link[rel="manifest"]')).toHaveCount(0)
  await page.goto('/admin/login')
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/admin/manifest.webmanifest')
})

test('the service worker script is served fresh with an /admin scope allowance', async ({ request }) => {
  const res = await request.get('/admin/sw.js')
  expect(res.status()).toBe(200)
  expect(res.headers()['content-type']).toContain('javascript')
  expect(res.headers()['cache-control']).toContain('no-cache')
  expect(res.headers()['service-worker-allowed']).toBe('/admin')
})

test('server path: a signed-in share lands on the form with the photo', async ({ page }) => {
  await signInAsOwner(page)
  const res = await page.request.post('/admin/share', { multipart: shareForm([BIG]), maxRedirects: 0 })
  expect(res.status()).toBe(303)
  const location = res.headers()['location']
  expect(location).toMatch(/^\/admin\/products\/new\?batch=[0-9a-f-]+$/)
  await page.goto(location)
  await expect(page.locator('[data-testid^="photo-"][data-status="done"]')).toHaveCount(1)
})

test('server path: unusable files are reported on the form', async ({ page }) => {
  await signInAsOwner(page)
  const res = await page.request.post('/admin/share', { multipart: shareForm([BIG, PDF]), maxRedirects: 0 })
  const location = res.headers()['location']
  expect(location).toContain('rejected=1')
  await page.goto(location)
  await expect(page.getByText('1 file could not be used (unsupported type or too large).')).toBeVisible()
  await expect(page.locator('[data-testid^="photo-"][data-status="done"]')).toHaveCount(1)
})

test('server path: without a session the owner is asked to sign in and share again', async ({ playwright, baseURL }) => {
  const anon = await playwright.request.newContext({ baseURL })
  const res = await anon.post('/admin/share', { multipart: shareForm([BIG]), maxRedirects: 0 })
  expect(res.status()).toBe(303)
  expect(res.headers()['location']).toBe('/admin/login?next=share')
  await anon.dispose()
})

test('the login page explains what to do after a share', async ({ page }) => {
  await page.goto('/admin/login?next=share')
  await expect(page.getByText('Please sign in, then share the photos again.')).toBeVisible()
})

test('installed app: the service worker receives the share and the form uploads the photos', async ({ page }) => {
  await signInAsOwner(page)
  await waitForServiceWorker(page)
  await shareLikeAndroid(page, [BIG, SECOND])
  await expect(page).toHaveURL(/\/admin\/products\/new\?shared=[0-9a-f-]+$/)
  await expect(page.locator('[data-testid^="photo-"][data-status="done"]')).toHaveCount(2, { timeout: 30_000 })
})

test('installed app: shared photos survive having to sign in first', async ({ page }) => {
  await signInAsOwner(page)
  await waitForServiceWorker(page)
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page).toHaveURL(/\/admin\/login$/)

  await shareLikeAndroid(page, [SECOND])
  await expect(page).toHaveURL(/\/admin\/share\/received\?id=/)
  await expect(page.getByText('Please sign in. Your shared photos will be added after you sign in.')).toBeVisible()
  await page.getByRole('link', { name: 'Sign in' }).click()
  await page.getByLabel('Email or phone').fill(E2E_OWNER.login)
  await page.getByLabel('Password').fill(E2E_OWNER.password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/admin\/products\/new\?shared=/)
  await expect(page.locator('[data-testid^="photo-"][data-status="done"]')).toHaveCount(1, { timeout: 30_000 })
})

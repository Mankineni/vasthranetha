import fs from 'node:fs'
import { expect, test } from '@playwright/test'
import { findPublic, fixture, signInAsOwner, uniqueName } from './helpers'

const SECRETS = ['ZZDEALER', 'ZZCODE', '777123', 'ZZNOTE']

/** A small MP4 whose metadata says where it was recorded, as phones write it. */
function mp4WithLocation(gps: string): Buffer {
  const box = (type: string, ...parts: Buffer[]) => {
    const body = Buffer.concat(parts)
    const head = Buffer.alloc(8)
    head.writeUInt32BE(8 + body.length, 0)
    head.write(type, 4, 'latin1')
    return Buffer.concat([head, body])
  }
  const ftyp = box('ftyp', Buffer.from('isom\0\0\x02\0isommp41', 'latin1'))
  const moov = box('moov', box('mvhd', Buffer.alloc(100)), box('udta', box('\xa9xyz', Buffer.from(gps, 'latin1'))))
  return Buffer.concat([ftyp, moov, box('mdat', Buffer.alloc(2048, 0x11))])
}

test('a product video is served without the location it was recorded at', async ({ page, request }) => {
  const GPS = '+17.3850+078.4867/'
  await signInAsOwner(page)
  const name = uniqueName('Video Privacy')
  await page.goto('/admin/products/new')
  await page.getByTestId('photo-input').setInputFiles([
    { name: 'second.jpg', mimeType: 'image/jpeg', buffer: fs.readFileSync(fixture('second.jpg')) },
    { name: 'clip.mp4', mimeType: 'video/mp4', buffer: mp4WithLocation(GPS) },
  ])
  await expect(page.locator('[data-testid^="photo-"][data-status="done"]')).toHaveCount(2, { timeout: 30_000 })
  await page.getByTestId('name').fill(name)
  await page.getByTestId('price').fill('1999')
  await page.getByTestId('publish').click()
  await expect(page).toHaveURL(/\/admin\/products$/)

  const [card] = await findPublic(request, name)
  const html = await (await request.get(card.path)).text()
  const src = /\/media\/[0-9a-f]{2}\/[0-9a-f]{64}-orig\.mp4/.exec(html)![0]
  const video = await request.get(src)
  expect(video.status()).toBe(200)
  expect((await video.body()).toString('latin1')).not.toContain(GPS)
})

test('dealer details never reach a signed-out visitor, and admin is closed to them', async ({ page, request }) => {
  // The owner adds a product with every private field filled in.
  await signInAsOwner(page)
  const name = uniqueName('Private Check')
  await page.goto('/admin/products/new')
  await page.getByTestId('photo-input').setInputFiles([fixture('second.jpg')])
  await expect(page.locator('[data-testid^="photo-"][data-status="done"]')).toHaveCount(1, { timeout: 30_000 })
  await page.getByTestId('name').fill(name)
  await page.getByTestId('price').fill('1450')
  await page.getByLabel('Dealer name').fill('ZZDEALER')
  await page.getByLabel("Dealer's code").fill('ZZCODE')
  await page.getByTestId('dealer-price').fill('777123')
  await page.getByLabel('Notes').fill('ZZNOTE')
  await page.getByTestId('publish').click()
  await expect(page).toHaveURL(/\/admin\/products$/)
  await page.getByRole('link', { name }).click()
  await expect(page).toHaveURL(/\/admin\/products\/\d+$/)
  const editPath = new URL(page.url()).pathname

  // `request` carries no session: it is a signed-out visitor.
  const [card] = await findPublic(request, name)
  expect(card).toBeTruthy()
  const publicUrls = [
    '/',
    '/new',
    '/c/sarees',
    card.path,
    `/search?q=${card.code}`,
    '/api/products',
    `/api/products?q=${encodeURIComponent(card.code)}`,
    '/sitemap.xml',
  ]
  for (const url of publicUrls) {
    const res = await request.get(url)
    expect(res.status(), url).toBe(200)
    const body = await res.text()
    for (const secret of SECRETS) expect(body, `${url} leaks ${secret}`).not.toContain(secret)
  }

  // Photo originals keep the camera's EXIF data (GPS location included), so only processed versions are served.
  const page2 = await request.get(card.path)
  const variant = /\/media\/[0-9a-f]{2}\/[0-9a-f]{64}-\d+\.webp/.exec(await page2.text())![0]
  for (const ext of ['jpg', 'png', 'webp']) {
    expect((await request.get(variant.replace(/-\d+\.webp$/, `-orig.${ext}`))).status(), ext).toBe(404)
  }
  expect((await request.get(variant)).status()).toBe(200)

  const adminPages = [
    '/admin',
    '/admin/products',
    '/admin/products/new',
    editPath,
    '/admin/settings',
    '/admin/settings/brand',
    '/admin/settings/lists',
    '/admin/settings/bands',
    '/admin/settings/pages',
  ]
  for (const url of adminPages) {
    const res = await request.get(url, { maxRedirects: 0 })
    expect([303, 307, 308], url).toContain(res.status())
    expect(res.headers()['location'], url).toContain('/admin/login')
    for (const secret of SECRETS) expect(await res.text(), url).not.toContain(secret)
  }

  const file = { name: 'x.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('x') }
  expect((await request.post('/admin/upload', { multipart: { batchId: 'abcdefgh-1234', file } })).status()).toBe(401)
  expect((await request.post('/admin/site-image', { multipart: { target: 'banner', file } })).status()).toBe(401)
  expect((await request.post('/admin/autofill', { data: { text: 'Soft silk' } })).status()).toBe(401)
  const share = await request.post('/admin/share', { multipart: { files: file }, maxRedirects: 0 })
  expect(share.status()).toBe(303)
  expect(share.headers()['location']).toBe('/admin/login?next=share')
})

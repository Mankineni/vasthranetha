import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { eq } from 'drizzle-orm'
import sharp from 'sharp'
import { createTestDb } from '../helpers/db'
import { heicHeader, makeImage, mp4Header, padTo } from '../helpers/images'
import { makeCategories, makeInput, makeUser } from '../helpers/fixtures'
import { media } from '@/db/schema'
import { validateUpload } from '@/lib/media/validate'
import { DISPLAY_WIDTHS, LOW_RES_LIMIT, processPhoto } from '@/lib/media/process'
import {
  deleteMediaRows,
  listBatch,
  mediaUrl,
  purgeUnattached,
  savePhoto,
  saveSiteImage,
  saveVideo,
} from '@/lib/media/store'
import { serveMedia } from '@/lib/media/serve'
import { createProduct } from '@/lib/catalogue/admin'

const MB = 1024 * 1024
let mediaDir: string

beforeEach(() => {
  mediaDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boutique-media-'))
})
afterEach(() => {
  fs.rmSync(mediaDir, { recursive: true, force: true })
})

const exists = (p: string) => fs.existsSync(path.join(mediaDir, p))
function allPaths(m: { originalPath: string; variants: { path: string }[]; previewPath: string | null }) {
  return [m.originalPath, ...m.variants.map((v) => v.path), ...(m.previewPath ? [m.previewPath] : [])]
}

describe('processPhoto', () => {
  test('constants', () => {
    expect(DISPLAY_WIDTHS).toEqual([480, 960, 1600, 2400])
    expect(LOW_RES_LIMIT).toBe(1200)
  })

  test('a 3000×4000 photo gets all four sizes as WebP, keeping 3:4', async () => {
    const out = await processPhoto(await makeImage({ width: 3000, height: 4000, format: 'jpeg' }))
    expect(out.variants.map((v) => v.width)).toEqual([480, 960, 1600, 2400])
    for (const v of out.variants) {
      const meta = await sharp(v.data).metadata()
      expect(meta.format).toBe('webp')
      expect(meta.height).toBe(v.width)
      expect(meta.width).toBe(Math.round((v.width * 3) / 4))
    }
  })

  test('a 1280×960 photo gets 480, 960 and its own size, nothing larger', async () => {
    const out = await processPhoto(await makeImage({ width: 1280, height: 960, format: 'jpeg' }))
    expect(out.variants.map((v) => v.width)).toEqual([480, 960, 1280])
  })

  test('a 300×400 photo gets exactly one size', async () => {
    const out = await processPhoto(await makeImage({ width: 300, height: 400, format: 'png' }))
    expect(out.variants.map((v) => v.width)).toEqual([400])
  })

  test('camera orientation is applied', async () => {
    const out = await processPhoto(await makeImage({ width: 400, height: 300, format: 'jpeg', orientation: 6 }))
    expect(out).toMatchObject({ width: 300, height: 400 })
    const meta = await sharp(out.variants[0].data).metadata()
    expect([meta.width, meta.height]).toEqual([300, 400])
  })

  test('preview is a JPEG of at most 1200 on the long side', async () => {
    const big = await processPhoto(await makeImage({ width: 3000, height: 4000, format: 'jpeg' }))
    const bigMeta = await sharp(big.preview).metadata()
    expect(bigMeta.format).toBe('jpeg')
    expect(bigMeta.height).toBe(1200)
    const small = await processPhoto(await makeImage({ width: 300, height: 400, format: 'jpeg' }))
    expect((await sharp(small.preview).metadata()).height).toBe(400)
  })

  test('fine red and gold detail keeps its colour', async () => {
    // Thin gold "zari" threads on maroon and red dots on red: the worst case for chroma subsampling.
    const W = 480
    const H = 640
    const threads = Array.from({ length: W / 6 }, (_, i) => `<rect x="${i * 6}" width="2" height="${H}" fill="#d4a73a"/>`)
    const dots: string[] = []
    for (let y = 10; y < H / 2; y += 9) for (let x = (y % 18) / 2; x < W; x += 9) dots.push(`<circle cx="${x}" cy="${y}" r="1.6" fill="#c9182f"/>`)
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
      <rect width="${W}" height="${H / 2}" fill="#6e0f1f"/><rect y="${H / 2}" width="${W}" height="${H / 2}" fill="#b0122b"/>
      <g opacity="0.9">${threads.join('')}</g><g transform="translate(0 ${H / 2})">${dots.join('')}</g></svg>`
    const png = await sharp(Buffer.from(svg)).png().toBuffer()
    const ref = await sharp(png).removeAlpha().raw().toBuffer()

    const out = await processPhoto(png)
    const full = out.variants.find((v) => v.width === H)! // same size as the source, so pixels line up
    const got = await sharp(full.data).removeAlpha().raw().toBuffer()

    const lab = (r: number, g: number, b: number) => {
      const lin = (c: number) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
      const [R, G, B] = [lin(r), lin(g), lin(b)]
      const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)
      const X = f((0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047)
      const Y = f(0.2126 * R + 0.7152 * G + 0.0722 * B)
      const Z = f((0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883)
      return [116 * Y - 16, 500 * (X - Y), 200 * (Y - Z)]
    }
    let sum = 0
    for (let i = 0; i < W * H; i++) {
      const a = lab(ref[i * 3], ref[i * 3 + 1], ref[i * 3 + 2])
      const b = lab(got[i * 3], got[i * 3 + 1], got[i * 3 + 2])
      sum += Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
    }
    // Plain 4:2:0 WebP scores about 9 here; smart subsampling about 7.
    expect(sum / (W * H)).toBeLessThan(8)
  })

  test('output is sRGB', async () => {
    const out = await processPhoto(await makeImage({ width: 800, height: 600, format: 'jpeg' }))
    expect((await sharp(out.variants[0].data).metadata()).space).toBe('srgb')
  })
})

describe('validateUpload', () => {
  test('accepts JPEG, PNG, WebP and MP4 by content', async () => {
    expect(await validateUpload(await makeImage({ width: 10, height: 10, format: 'jpeg' }))).toEqual({
      ok: true,
      kind: 'photo',
      ext: 'jpg',
    })
    expect(await validateUpload(await makeImage({ width: 10, height: 10, format: 'png' }))).toMatchObject({ ext: 'png' })
    expect(await validateUpload(await makeImage({ width: 10, height: 10, format: 'webp' }))).toMatchObject({
      ext: 'webp',
    })
    expect(await validateUpload(mp4Header())).toEqual({ ok: true, kind: 'video', ext: 'mp4' })
  })

  const notSupported = 'This file type is not supported. Use JPEG, PNG or WebP photos, or MP4 video.'

  test.each([
    ['PDF', () => Buffer.from('%PDF-1.7\n1 0 obj\n<<>>\nendobj\n')],
    ['HEIC', () => heicHeader()],
    ['text', () => Buffer.from('this is not really a jpeg')],
  ])('rejects %s', async (_label, make) => {
    expect(await validateUpload(make())).toEqual({ ok: false, reason: notSupported })
  })

  test('rejects a 26 MB photo and a 21 MB video', async () => {
    const jpeg = await makeImage({ width: 10, height: 10, format: 'jpeg' })
    expect(await validateUpload(padTo(jpeg, 26 * MB))).toEqual({ ok: false, reason: 'Photo is larger than 25 MB.' })
    expect(await validateUpload(padTo(mp4Header(), 21 * MB))).toEqual({
      ok: false,
      reason: 'Video is larger than 20 MB.',
    })
  })
})

describe('store', () => {
  test('savePhoto keeps the original byte for byte and flags low resolution', async () => {
    const db = createTestDb()
    const buf = await makeImage({ width: 900, height: 1199, format: 'jpeg' })
    const saved = await savePhoto(db, buf, { batchId: 'b1', mediaDir, now: 1 })
    expect(saved.lowRes).toBe(true)
    expect(fs.readFileSync(path.join(mediaDir, saved.originalPath)).equals(buf)).toBe(true)
    expect(saved.originalPath).toMatch(/^[0-9a-f]{2}\/[0-9a-f]{64}-orig\.jpg$/)
    expect(saved.previewPath).toMatch(/-og\.jpg$/)
    for (const p of allPaths(saved)) expect(exists(p)).toBe(true)

    const ok = await savePhoto(db, await makeImage({ width: 900, height: 1200, format: 'jpeg' }), {
      batchId: 'b1',
      mediaDir,
      now: 1,
    })
    expect(ok.lowRes).toBe(false)
    expect(listBatch(db, 'b1').map((m) => m.id)).toEqual([saved.id, ok.id])
  })

  test('saveVideo stores the file as is', async () => {
    const db = createTestDb()
    const v = await saveVideo(db, mp4Header(), { batchId: 'b', mediaDir, now: 1 })
    expect(v).toMatchObject({ kind: 'video', variants: [], previewPath: null })
    expect(v.originalPath).toMatch(/-orig\.mp4$/)
    expect(exists(v.originalPath)).toBe(true)
  })

  test('identical uploads share files; files go only when the last row goes', async () => {
    const db = createTestDb()
    const buf = await makeImage({ width: 600, height: 800, format: 'jpeg' })
    const a = await savePhoto(db, buf, { batchId: 'b', mediaDir, now: 1 })
    const b = await savePhoto(db, buf, { batchId: 'b', mediaDir, now: 1 })
    expect(a.id).not.toBe(b.id)
    expect(a.originalPath).toBe(b.originalPath)

    await deleteMediaRows(db, [a.id], mediaDir)
    for (const p of allPaths(b)) expect(exists(p)).toBe(true)
    await deleteMediaRows(db, [b.id], mediaDir)
    for (const p of allPaths(b)) expect(exists(p)).toBe(false)
    expect(db.select().from(media).all()).toHaveLength(0)
  })

  test('deleteMediaRows ignores files already missing', async () => {
    const db = createTestDb()
    const a = await savePhoto(db, await makeImage({ width: 600, height: 800, format: 'jpeg' }), {
      batchId: 'b',
      mediaDir,
      now: 1,
    })
    fs.rmSync(path.join(mediaDir, a.originalPath))
    await expect(deleteMediaRows(db, [a.id], mediaDir)).resolves.toBeUndefined()
  })

  test('purge removes old unattached rows only', async () => {
    const db = createTestDb()
    const hour = 3600_000
    const now = 100 * hour
    const old = await savePhoto(db, await makeImage({ width: 60, height: 80, format: 'jpeg' }), {
      batchId: 'old',
      mediaDir,
      now: now - 25 * hour,
    })
    const recent = await savePhoto(db, await makeImage({ width: 60, height: 80, format: 'jpeg' }), {
      batchId: 'new',
      mediaDir,
      now: now - 23 * hour,
    })
    const attachedOld = await savePhoto(db, await makeImage({ width: 60, height: 80, format: 'jpeg' }), {
      batchId: 'x',
      mediaDir,
      now: now - 300 * hour,
    })
    const { sarees } = makeCategories(db)
    createProduct(db, makeInput(sarees, { mediaIds: [attachedOld.id] }), makeUser(db), { publish: true, now })

    expect(await purgeUnattached(db, mediaDir, now)).toBe(1)
    expect(exists(old.originalPath)).toBe(false)
    expect(exists(recent.originalPath)).toBe(true)
    expect(exists(attachedOld.originalPath)).toBe(true)
  })

  test('shared files survive a purge of the unattached copy', async () => {
    const db = createTestDb()
    const hour = 3600_000
    const now = 100 * hour
    const buf = await makeImage({ width: 600, height: 800, format: 'jpeg' })
    const kept = await savePhoto(db, buf, { batchId: 'a', mediaDir, now })
    const stray = await savePhoto(db, buf, { batchId: 'b', mediaDir, now: now - 25 * hour })
    const { sarees } = makeCategories(db)
    createProduct(db, makeInput(sarees, { mediaIds: [kept.id] }), makeUser(db), { publish: true, now })

    expect(await purgeUnattached(db, mediaDir, now)).toBe(1)
    expect(db.select().from(media).where(eq(media.id, stray.id)).get()).toBeUndefined()
    for (const p of allPaths(kept)) expect(exists(p)).toBe(true)
  })

  test('saveSiteImage writes under site/ and returns variants', async () => {
    const out = await saveSiteImage(await makeImage({ width: 2000, height: 800, format: 'png' }), mediaDir)
    expect(out.path).toMatch(/^site\//)
    expect(out.variants.map((v) => v.width)).toEqual([480, 960, 1600, 2000])
    for (const v of out.variants) expect(exists(v.path)).toBe(true)
  })

  test('mediaUrl', () => {
    expect(mediaUrl('ab/abc-480.webp')).toBe('/media/ab/abc-480.webp')
  })
})

describe('serveMedia', () => {
  async function stored() {
    const db = createTestDb()
    return savePhoto(db, await makeImage({ width: 600, height: 800, format: 'jpeg' }), { batchId: 'b', mediaDir, now: 1 })
  }
  const get = (p: string, headers: Record<string, string> = {}) =>
    serveMedia(new Request(`http://x.test/media/${p}`, { headers }), p.split('/'), mediaDir)

  test('serves a file with long cache and its type', async () => {
    const m = await stored()
    const res = await get(m.variants[0].path)
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('public, max-age=31536000, immutable')
    expect(res.headers.get('content-type')).toBe('image/webp')
    expect(res.headers.get('accept-ranges')).toBe('bytes')
    const body = Buffer.from(await res.arrayBuffer())
    expect(body.equals(fs.readFileSync(path.join(mediaDir, m.variants[0].path)))).toBe(true)
  })

  test('.. and missing files are 404', async () => {
    await stored()
    expect((await get('../secret.txt')).status).toBe(404)
    expect((await serveMedia(new Request('http://x.test/'), ['..', 'x'], mediaDir)).status).toBe(404)
    expect((await get('ab/missing.jpg')).status).toBe(404)
  })

  test('byte ranges for video seeking', async () => {
    const m = await stored()
    const full = fs.readFileSync(path.join(mediaDir, m.originalPath))
    const res = await get(m.originalPath, { range: 'bytes=0-99' })
    expect(res.status).toBe(206)
    expect(res.headers.get('content-range')).toBe(`bytes 0-99/${full.length}`)
    expect(Buffer.from(await res.arrayBuffer()).equals(full.subarray(0, 100))).toBe(true)

    const tail = await get(m.originalPath, { range: 'bytes=-10' })
    expect(Buffer.from(await tail.arrayBuffer()).equals(full.subarray(full.length - 10))).toBe(true)

    expect((await get(m.originalPath, { range: `bytes=${full.length + 5}-` })).status).toBe(416)
  })
})

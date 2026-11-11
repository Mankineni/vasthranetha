import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createTestDb } from '../helpers/db'
import { makeImage, mp4Header } from '../helpers/images'
import { media } from '@/db/schema'
import { handleShare } from '@/lib/media/share'
import { listBatch } from '@/lib/media/store'

let mediaDir: string
beforeEach(() => {
  mediaDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boutique-share-'))
})
afterEach(() => fs.rmSync(mediaDir, { recursive: true, force: true }))

const owner = { id: 1, name: 'Asha' }
const asFile = (buf: Buffer, name: string, type = 'image/jpeg') => new File([new Uint8Array(buf)], name, { type })

async function photos(n: number) {
  const out: File[] = []
  for (let i = 0; i < n; i++) out.push(asFile(await makeImage({ width: 60 + i, height: 80, format: 'jpeg' }), `p${i}.jpg`))
  return out
}

function parse(location: string) {
  const url = new URL(location, 'http://x.test')
  return { path: url.pathname, batch: url.searchParams.get('batch'), rejected: url.searchParams.get('rejected') }
}

test('valid photos are stored under one batch, in the order shared', async () => {
  const db = createTestDb()
  const files = await photos(3)
  const loc = parse(await handleShare(db, owner, files, { mediaDir, now: 1 }))
  expect(loc.path).toBe('/admin/products/new')
  expect(loc.rejected).toBeNull()
  const batch = listBatch(db, loc.batch!)
  expect(batch).toHaveLength(3)
  expect(batch.map((m) => m.width)).toEqual([60, 61, 62])
})

test('an unsupported file is counted as rejected and the rest are kept', async () => {
  const db = createTestDb()
  const files = [...(await photos(2)), new File(['%PDF-1.7 hello'], 'doc.pdf', { type: 'application/pdf' })]
  const loc = parse(await handleShare(db, owner, files, { mediaDir, now: 1 }))
  expect(listBatch(db, loc.batch!)).toHaveLength(2)
  expect(loc.rejected).toBe('1')
})

test('more than 12 photos or more than one video: the extras are rejected', async () => {
  const db = createTestDb()
  const video = (i: number) => asFile(Buffer.concat([mp4Header(), Buffer.from([i])]), `v${i}.mp4`, 'video/mp4')
  const files = [...(await photos(13)), video(1), video(2)]
  const loc = parse(await handleShare(db, owner, files, { mediaDir, now: 1 }))
  const batch = listBatch(db, loc.batch!)
  expect(batch.filter((m) => m.kind === 'photo')).toHaveLength(12)
  expect(batch.filter((m) => m.kind === 'video')).toHaveLength(1)
  expect(loc.rejected).toBe('2')
})

test('without a session nothing is stored and the owner is sent to sign in', async () => {
  const db = createTestDb()
  expect(await handleShare(db, null, await photos(2), { mediaDir, now: 1 })).toBe('/admin/login?next=share')
  expect(db.select().from(media).all()).toHaveLength(0)
})

test('a share with no usable files still opens the form, reporting the rejects', async () => {
  const db = createTestDb()
  const loc = parse(await handleShare(db, owner, [new File(['nope'], 'a.txt', { type: 'text/plain' })], { mediaDir, now: 1 }))
  expect(loc.path).toBe('/admin/products/new')
  expect(loc.batch).toBeNull()
  expect(loc.rejected).toBe('1')
})

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createTestDb } from '../helpers/db'
import { makeCategories, makeInput, makeUser } from '../helpers/fixtures'
import { makeImage } from '../helpers/images'
import { createProduct, getAdminProduct } from '@/lib/catalogue/admin'
import { deleteProductAndFiles } from '@/lib/catalogue/remove'
import { savePhoto } from '@/lib/media/store'

let mediaDir: string
beforeEach(() => {
  mediaDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boutique-remove-'))
})
afterEach(() => fs.rmSync(mediaDir, { recursive: true, force: true }))

const onDisk = (p: string) => fs.existsSync(path.join(mediaDir, p))

test('deleting a product removes it and its files', async () => {
  const db = createTestDb()
  const { sarees } = makeCategories(db)
  const user = makeUser(db)
  const photo = await savePhoto(db, await makeImage({ width: 600, height: 800, format: 'jpeg' }), {
    batchId: 'b',
    mediaDir,
    now: 1,
  })
  const p = createProduct(db, makeInput(sarees, { mediaIds: [photo.id] }), user, { publish: true, now: 1 })

  await deleteProductAndFiles(db, p.id, mediaDir)

  expect(getAdminProduct(db, p.id)).toBeNull()
  expect(onDisk(photo.originalPath)).toBe(false)
  for (const v of photo.variants) expect(onDisk(v.path)).toBe(false)
})

test('files shared by two products stay until the second product is deleted', async () => {
  const db = createTestDb()
  const { sarees } = makeCategories(db)
  const user = makeUser(db)
  const buf = await makeImage({ width: 600, height: 800, format: 'jpeg' })
  const a = await savePhoto(db, buf, { batchId: 'b', mediaDir, now: 1 })
  const b = await savePhoto(db, buf, { batchId: 'b', mediaDir, now: 1 })
  const p1 = createProduct(db, makeInput(sarees, { mediaIds: [a.id] }), user, { publish: true, now: 1 })
  const p2 = createProduct(db, makeInput(sarees, { mediaIds: [b.id] }), user, { publish: true, now: 1 })

  await deleteProductAndFiles(db, p1.id, mediaDir)
  expect(onDisk(b.originalPath)).toBe(true)
  expect(getAdminProduct(db, p2.id)?.media).toHaveLength(1)

  await deleteProductAndFiles(db, p2.id, mediaDir)
  expect(onDisk(b.originalPath)).toBe(false)
})

test('deleting a product that no longer exists does nothing', async () => {
  const db = createTestDb()
  await expect(deleteProductAndFiles(db, 9999, mediaDir)).resolves.toBeUndefined()
})

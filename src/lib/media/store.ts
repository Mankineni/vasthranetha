import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { and, asc, eq, inArray, isNull, lt } from 'drizzle-orm'
import type { Db } from '@/db/client'
import { media } from '@/db/schema'
import type { MediaItem } from '@/lib/catalogue/types'
import { stripMp4Metadata } from './mp4'
import { LOW_RES_LIMIT, processPhoto } from './process'
import { validateUpload } from './validate'

const UNATTACHED_TTL_MS = 24 * 60 * 60 * 1000

type SaveOpts = { batchId: string; mediaDir: string; now: number }

function hashOf(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex')
}

async function writeIfMissing(mediaDir: string, rel: string, data: Buffer): Promise<void> {
  const full = path.join(mediaDir, rel)
  try {
    await fs.access(full)
    return
  } catch {
    // not there yet
  }
  await fs.mkdir(path.dirname(full), { recursive: true })
  const tmp = `${full}.${process.pid}.${Date.now()}.tmp`
  await fs.writeFile(tmp, data)
  await fs.rename(tmp, full)
}

function toItem(r: typeof media.$inferSelect): MediaItem {
  return {
    id: r.id,
    kind: r.kind,
    originalPath: r.originalPath,
    width: r.width,
    height: r.height,
    variants: r.variants,
    previewPath: r.previewPath,
  }
}

/** Writes original + display versions + preview JPEG for one photo. Paths are relative to mediaDir. */
async function writePhotoFiles(buf: Buffer, mediaDir: string, folder: string, ext: string) {
  const hash = hashOf(buf)
  const base = `${folder}/${hash}`
  const processed = await processPhoto(buf)
  const originalPath = `${base}-orig.${ext}`
  await writeIfMissing(mediaDir, originalPath, buf)
  const variants = []
  for (const v of processed.variants) {
    const p = `${base}-${v.width}.webp`
    await writeIfMissing(mediaDir, p, v.data)
    variants.push({ width: v.width, path: p })
  }
  const previewPath = `${base}-og.jpg`
  await writeIfMissing(mediaDir, previewPath, processed.preview)
  return { originalPath, variants, previewPath, width: processed.width, height: processed.height }
}

export async function savePhoto(db: Db, buf: Buffer, opts: SaveOpts): Promise<MediaItem & { lowRes: boolean }> {
  const check = await validateUpload(buf)
  if (!check.ok) throw new Error(check.reason)
  if (check.kind !== 'photo') throw new Error('Expected a photo.')
  const hash = hashOf(buf)
  const files = await writePhotoFiles(buf, opts.mediaDir, hash.slice(0, 2), check.ext)
  const [row] = db
    .insert(media)
    .values({ kind: 'photo', batchId: opts.batchId, createdAt: opts.now, ...files })
    .returning()
    .all()
  return { ...toItem(row), lowRes: Math.max(files.width, files.height) < LOW_RES_LIMIT }
}

export async function saveVideo(db: Db, buf: Buffer, opts: SaveOpts): Promise<MediaItem> {
  const check = await validateUpload(buf)
  if (!check.ok) throw new Error(check.reason)
  if (check.kind !== 'video') throw new Error('Expected a video.')
  // Videos are served as stored, so recording location and device details are removed first.
  const clean = stripMp4Metadata(buf)
  const hash = hashOf(clean)
  const originalPath = `${hash.slice(0, 2)}/${hash}-orig.mp4`
  await writeIfMissing(opts.mediaDir, originalPath, clean)
  const [row] = db
    .insert(media)
    .values({ kind: 'video', batchId: opts.batchId, createdAt: opts.now, originalPath, variants: [] })
    .returning()
    .all()
  return toItem(row)
}

/**
 * Logo, banner, category tiles and customer photos. Stored under site/ so
 * they never share files with product media, and with no media row.
 */
export async function saveSiteImage(
  buf: Buffer,
  mediaDir: string,
): Promise<{ path: string; variants: { width: number; path: string }[] }> {
  const check = await validateUpload(buf)
  if (!check.ok) throw new Error(check.reason)
  if (check.kind !== 'photo') throw new Error('Expected a photo.')
  const files = await writePhotoFiles(buf, mediaDir, 'site', check.ext)
  return { path: files.originalPath, variants: files.variants }
}

export function listBatch(db: Db, batchId: string): MediaItem[] {
  return db.select().from(media).where(eq(media.batchId, batchId)).orderBy(asc(media.id)).all().map(toItem)
}

function filesOf(r: typeof media.$inferSelect): string[] {
  return [r.originalPath, ...r.variants.map((v) => v.path), ...(r.previewPath ? [r.previewPath] : [])]
}

/**
 * The only way media files are removed. Deletes the rows, then removes each
 * of their files that no remaining row still uses. All files of one upload
 * derive from its original, so a shared original means shared files.
 */
export async function deleteMediaRows(db: Db, ids: number[], mediaDir: string): Promise<void> {
  if (!ids.length) return
  const rows = db.select().from(media).where(inArray(media.id, ids)).all()
  db.delete(media).where(inArray(media.id, ids)).run()
  const originals = [...new Set(rows.map((r) => r.originalPath))]
  const stillUsed = new Set(
    originals.length
      ? db
          .select({ p: media.originalPath })
          .from(media)
          .where(inArray(media.originalPath, originals))
          .all()
          .map((r) => r.p)
      : [],
  )
  for (const r of rows) {
    if (stillUsed.has(r.originalPath)) continue
    for (const rel of filesOf(r)) {
      await fs.rm(path.join(mediaDir, rel), { force: true })
    }
  }
}

export async function purgeUnattached(db: Db, mediaDir: string, now: number): Promise<number> {
  const stale = db
    .select({ id: media.id })
    .from(media)
    .where(and(isNull(media.productId), lt(media.createdAt, now - UNATTACHED_TTL_MS)))
    .all()
  await deleteMediaRows(
    db,
    stale.map((r) => r.id),
    mediaDir,
  )
  return stale.length
}

export { mediaUrl } from './urls'

export function mediaDirFromEnv(): string {
  return path.resolve(/*turbopackIgnore: true*/ process.env.MEDIA_DIR || './data/media')
}

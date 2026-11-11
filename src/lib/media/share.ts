import { randomUUID } from 'node:crypto'
import type { Db } from '@/db/client'
import { MAX_PHOTOS, MAX_VIDEOS } from '@/lib/catalogue/types'
import { savePhoto, saveVideo } from './store'
import { validateUpload } from './validate'

/**
 * Server side of "share from WhatsApp" (the fallback when the service worker
 * is not running): stores every usable file under a new batch and returns
 * where to send the owner next.
 */
export async function handleShare(
  db: Db,
  owner: { id: number } | null,
  files: File[],
  opts: { mediaDir: string; now: number },
): Promise<string> {
  if (!owner) return '/admin/login?next=share'

  const batchId = randomUUID()
  let photos = 0
  let videos = 0
  let rejected = 0
  for (const file of files) {
    const buf = Buffer.from(await file.arrayBuffer())
    const check = await validateUpload(buf)
    if (!check.ok) {
      rejected++
      continue
    }
    if ((check.kind === 'photo' && photos >= MAX_PHOTOS) || (check.kind === 'video' && videos >= MAX_VIDEOS)) {
      rejected++
      continue
    }
    try {
      if (check.kind === 'photo') {
        await savePhoto(db, buf, { batchId, mediaDir: opts.mediaDir, now: opts.now })
        photos++
      } else {
        await saveVideo(db, buf, { batchId, mediaDir: opts.mediaDir, now: opts.now })
        videos++
      }
    } catch {
      rejected++
    }
  }

  const params = new URLSearchParams()
  if (photos + videos > 0) params.set('batch', batchId)
  if (rejected > 0) params.set('rejected', String(rejected))
  const qs = params.toString()
  return qs ? `/admin/products/new?${qs}` : '/admin/products/new'
}

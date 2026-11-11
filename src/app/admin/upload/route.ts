import { getDb } from '@/db/client'
import { getOwner } from '@/lib/auth/guard'
import { mediaDirFromEnv, savePhoto, saveVideo } from '@/lib/media/store'
import { MAX_PHOTO_BYTES, REASON_PHOTO_SIZE, validateUpload } from '@/lib/media/validate'

export const dynamic = 'force-dynamic'

const BATCH_ID = /^[A-Za-z0-9-]{8,64}$/

const fail = (status: number, error: string) => Response.json({ error }, { status })

/** One file per request, so each photo shows its own progress and failure. */
export async function POST(req: Request) {
  if (!(await getOwner())) return fail(401, 'Please sign in again.')

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return fail(400, 'Upload failed. Please try again.')
  }
  const file = form.get('file')
  const batchId = String(form.get('batchId') ?? '')
  if (!(file instanceof File) || !BATCH_ID.test(batchId)) return fail(400, 'Upload failed. Please try again.')
  // Both limits are at most 25 MB, so anything bigger can be refused before reading it.
  if (file.size > MAX_PHOTO_BYTES) return fail(400, REASON_PHOTO_SIZE)

  const buf = Buffer.from(await file.arrayBuffer())
  const check = await validateUpload(buf)
  if (!check.ok) return fail(400, check.reason)

  const opts = { batchId, mediaDir: mediaDirFromEnv(), now: Date.now() }
  try {
    if (check.kind === 'photo') {
      const { lowRes, ...media } = await savePhoto(getDb(), buf, opts)
      return Response.json({ media, lowRes })
    }
    return Response.json({ media: await saveVideo(getDb(), buf, opts), lowRes: false })
  } catch (err) {
    console.error('upload failed', err)
    return fail(400, 'This file could not be read. Please try another.')
  }
}

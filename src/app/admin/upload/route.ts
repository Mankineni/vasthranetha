import { getDb } from '@/db/client'
import { getOwner } from '@/lib/auth/guard'
import { REASON_TOO_LARGE } from '@/lib/media/limits'
import { mediaDirFromEnv, savePhoto, saveVideo } from '@/lib/media/store'
import { MAX_PHOTO_BYTES, MAX_VIDEO_BYTES, REASON_PHOTO_SIZE, REASON_VIDEO_SIZE, validateUpload } from '@/lib/media/validate'

/** Room for the multipart wrapping around one file. */
const FORM_OVERHEAD_BYTES = 64 * 1024

export const dynamic = 'force-dynamic'

const BATCH_ID = /^[A-Za-z0-9-]{8,64}$/

const fail = (status: number, error: string) => Response.json({ error }, { status })

/** One file per request, so each photo shows its own progress and failure. */
export async function POST(req: Request) {
  if (!(await getOwner())) return fail(401, 'Please sign in again.')
  // Refuse an oversized body from its declared length, before reading it into memory.
  // (The photo picker already refuses such files on the phone; this is the safety net.)
  const declared = Number(req.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > MAX_PHOTO_BYTES + FORM_OVERHEAD_BYTES) return fail(413, REASON_TOO_LARGE)

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return fail(400, 'Upload failed. Please try again.')
  }
  const file = form.get('file')
  const batchId = String(form.get('batchId') ?? '')
  if (!(file instanceof File) || !BATCH_ID.test(batchId)) return fail(400, 'Upload failed. Please try again.')
  const isVideo = file.type.startsWith('video/')
  if (file.size > (isVideo ? MAX_VIDEO_BYTES : MAX_PHOTO_BYTES)) return fail(413, isVideo ? REASON_VIDEO_SIZE : REASON_PHOTO_SIZE)

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

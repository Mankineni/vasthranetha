import { getDb } from '@/db/client'
import { getOwner } from '@/lib/auth/guard'
import { listCategories, updateCategory } from '@/lib/catalogue/taxonomy'
import { mediaDirFromEnv, saveSiteImage } from '@/lib/media/store'
import { MAX_PHOTO_BYTES, REASON_PHOTO_SIZE } from '@/lib/media/validate'
import { getSettings, updateSettings } from '@/lib/settings/settings'

export const dynamic = 'force-dynamic'

// Which stored size each kind of site image displays at.
const DISPLAY_SIZE = { logo: 480, banner: 1600, customer: 960, tile: 960 } as const
type Target = keyof typeof DISPLAY_SIZE

const fail = (status: number, error: string) => Response.json({ error }, { status })

/** Uploads a logo, banner, customer photo or category tile and stores it in the settings. */
export async function POST(req: Request) {
  if (!(await getOwner())) return fail(401, 'Please sign in again.')
  // Refuse an oversized body from its declared length, before reading it into memory.
  const declared = Number(req.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > MAX_PHOTO_BYTES + 64 * 1024) return fail(413, REASON_PHOTO_SIZE)
  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return fail(400, 'Upload failed. Please try again.')
  }
  const file = form.get('file')
  const target = String(form.get('target') ?? '') as Target
  if (!(file instanceof File) || !(target in DISPLAY_SIZE)) return fail(400, 'Upload failed. Please try again.')
  if (file.size > MAX_PHOTO_BYTES) return fail(400, REASON_PHOTO_SIZE)

  const db = getDb()
  const categoryId = Number(form.get('categoryId'))
  if (target === 'tile' && !listCategories(db).some((c) => c.id === categoryId)) return fail(400, 'Unknown category.')

  let saved: Awaited<ReturnType<typeof saveSiteImage>>
  try {
    saved = await saveSiteImage(Buffer.from(await file.arrayBuffer()), mediaDirFromEnv())
  } catch (err) {
    return fail(400, err instanceof Error ? err.message : 'This photo could not be read.')
  }
  const sorted = [...saved.variants].sort((a, b) => a.width - b.width)
  const shown = (sorted.find((v) => v.width >= DISPLAY_SIZE[target]) ?? sorted[sorted.length - 1]).path

  if (target === 'logo') updateSettings(db, { logo: shown })
  else if (target === 'banner') updateSettings(db, { banner: shown })
  else if (target === 'customer') updateSettings(db, { customerPhotos: [...getSettings(db).customerPhotos, shown].slice(-12) })
  else updateCategory(db, categoryId, { tileImage: shown })

  return Response.json({ path: shown })
}

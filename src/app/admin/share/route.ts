import { getDb } from '@/db/client'
import { getOwner } from '@/lib/auth/guard'
import { handleShare } from '@/lib/media/share'
import { mediaDirFromEnv } from '@/lib/media/store'

export const dynamic = 'force-dynamic'

/** Share target fallback, used when the service worker did not take the share. */
export async function POST(req: Request) {
  const owner = await getOwner()
  let files: File[] = []
  if (owner) {
    try {
      files = (await req.formData()).getAll('files').filter((f): f is File => f instanceof File)
    } catch {
      files = []
    }
  }
  const location = await handleShare(getDb(), owner, files, { mediaDir: mediaDirFromEnv(), now: Date.now() })
  return new Response(null, { status: 303, headers: { Location: location } })
}

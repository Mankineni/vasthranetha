// Reads the files the service worker kept for a share (see src/lib/pwa/service-worker.ts).
import { SHARED_CACHE, SHARED_PREFIX } from '@/lib/pwa/service-worker'

export async function readSharedFiles(id: string): Promise<{ files: File[]; discard: () => Promise<void> }> {
  if (typeof caches === 'undefined') return { files: [], discard: async () => {} }
  const cache = await caches.open(SHARED_CACHE)
  const prefix = `${SHARED_PREFIX}${id}/`
  const keys = (await cache.keys())
    .filter((req) => new URL(req.url).pathname.startsWith(prefix))
    .sort((a, b) => a.url.localeCompare(b.url))
  const files: File[] = []
  for (const key of keys) {
    const res = await cache.match(key)
    if (!res) continue
    const blob = await res.blob()
    const name = decodeURIComponent(res.headers.get('X-File-Name') ?? 'photo.jpg')
    files.push(new File([blob], name, { type: res.headers.get('Content-Type') ?? blob.type }))
  }
  return {
    files,
    discard: async () => {
      await Promise.all(keys.map((k) => cache.delete(k)))
    },
  }
}

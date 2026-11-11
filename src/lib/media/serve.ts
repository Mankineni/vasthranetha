import fs from 'node:fs'
import path from 'node:path'
import { Readable } from 'node:stream'

const TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
}

const notFound = () => new Response('Not found', { status: 404 })

function stream(file: string, start: number, end: number): ReadableStream {
  return Readable.toWeb(fs.createReadStream(file, { start, end })) as ReadableStream
}

/** Serves a file from mediaDir. Files never change (names carry a content hash), so they are cached for a year. */
export async function serveMedia(req: Request, segments: string[], mediaDir: string): Promise<Response> {
  if (!segments.length || segments.some((s) => !s || s === '.' || s === '..' || /[\\:\0]/.test(s))) return notFound()
  const root = path.resolve(mediaDir)
  const file = path.resolve(root, ...segments)
  if (!file.startsWith(root + path.sep)) return notFound()
  const type = TYPES[path.extname(file).toLowerCase()]
  if (!type) return notFound()
  // Photo originals keep their camera metadata (GPS location, device). They stay on disk
  // for regenerating sizes, but only the processed, metadata-free versions are served.
  if (/-orig\.(jpe?g|png|webp)$/i.test(file)) return notFound()

  let size: number
  try {
    const st = await fs.promises.stat(file)
    if (!st.isFile()) return notFound()
    size = st.size
  } catch {
    return notFound()
  }

  const headers = new Headers({
    'Content-Type': type,
    'Cache-Control': 'public, max-age=31536000, immutable',
    'Accept-Ranges': 'bytes',
  })

  const range = req.headers.get('range')
  if (range) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim())
    let start = NaN
    let end = NaN
    if (m && m[1] !== '') {
      start = Number(m[1])
      end = m[2] !== '' ? Math.min(Number(m[2]), size - 1) : size - 1
    } else if (m && m[2] !== '') {
      const suffix = Number(m[2])
      start = Math.max(0, size - suffix)
      end = size - 1
    }
    if (!Number.isFinite(start) || start >= size || end < start) {
      headers.set('Content-Range', `bytes */${size}`)
      return new Response(null, { status: 416, headers })
    }
    headers.set('Content-Range', `bytes ${start}-${end}/${size}`)
    headers.set('Content-Length', String(end - start + 1))
    if (req.method === 'HEAD') return new Response(null, { status: 206, headers })
    return new Response(stream(file, start, end), { status: 206, headers })
  }

  headers.set('Content-Length', String(size))
  if (req.method === 'HEAD') return new Response(null, { status: 200, headers })
  return new Response(stream(file, 0, Math.max(0, size - 1)), { status: 200, headers })
}

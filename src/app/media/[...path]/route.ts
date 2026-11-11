import { mediaDirFromEnv } from '@/lib/media/store'
import { serveMedia } from '@/lib/media/serve'

export async function GET(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params
  return serveMedia(req, path.map(decodeURIComponent), mediaDirFromEnv())
}

export async function HEAD(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  return GET(req, ctx)
}

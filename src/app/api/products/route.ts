import { getDb } from '@/db/client'
import { listPublicProducts } from '@/lib/catalogue/public'
import { parseListParams } from '@/lib/catalogue/query'

export const dynamic = 'force-dynamic'

/** Public product cards for "load more". Same visibility rules as the pages. */
export function GET(req: Request) {
  const query = parseListParams(new URL(req.url).searchParams)
  const result = listPublicProducts(getDb(), { ...query, now: Date.now() })
  return Response.json(result, { headers: { 'Cache-Control': 'no-store' } })
}

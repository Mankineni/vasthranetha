import { getDb } from '@/db/client'
import { recordEvent, type EventType } from '@/lib/stats/stats'

export const dynamic = 'force-dynamic'

const CODE = /^[A-Za-z]{1,3}-\d{1,9}$/
const TYPES: EventType[] = ['view', 'order_tap']

/** Counts a product view or order tap. Always 204, no cookies, nothing about the visitor is stored. */
export async function POST(req: Request) {
  try {
    const body = JSON.parse((await req.text()).slice(0, 500)) as { code?: unknown; type?: unknown }
    if (typeof body.code === 'string' && CODE.test(body.code) && TYPES.includes(body.type as EventType)) {
      recordEvent(getDb(), body.code, body.type as EventType, Date.now(), req.headers.get('user-agent'))
    }
  } catch {
    // Ignore malformed requests.
  }
  return new Response(null, { status: 204 })
}

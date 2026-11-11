import { getDb } from '@/db/client'
import { getOwner } from '@/lib/auth/guard'
import { getAutofillClient, isAutofillEnabled, suggestFields } from '@/lib/autofill/autofill'
import { listFabrics } from '@/lib/catalogue/taxonomy'

export const dynamic = 'force-dynamic'

/** POST { text } → { suggestion } for the product form's "Fill for me" button. */
export async function POST(req: Request) {
  if (!(await getOwner())) return Response.json({ error: 'Please sign in again.' }, { status: 401 })
  const client = isAutofillEnabled() ? getAutofillClient() : null
  if (!client) return Response.json({ error: 'Fill for me is not set up.' }, { status: 503 })

  let text = ''
  try {
    const body = (await req.json()) as { text?: unknown }
    text = typeof body.text === 'string' ? body.text : ''
  } catch {
    text = ''
  }
  const result = await suggestFields(text, listFabrics(getDb()).map((f) => f.name), client)
  if (!result.ok) return Response.json({ error: 'Could not read that message.' }, { status: 503 })
  return Response.json({ suggestion: result.suggestion })
}

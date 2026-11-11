import { cookies } from 'next/headers'
import { getDb } from '@/db/client'
import { SESSION_COOKIE, signOut } from '@/lib/auth/sessions'

export async function POST() {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE)?.value
  if (token) signOut(getDb(), token)
  store.delete(SESSION_COOKIE)
  return new Response(null, { status: 303, headers: { Location: '/admin/login' } })
}

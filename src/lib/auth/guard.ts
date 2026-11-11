import 'server-only'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getDb } from '@/db/client'
import { siteUrl } from '@/lib/site'
import { getSessionUser, SESSION_COOKIE, SESSION_TTL_MS } from './sessions'

export type Owner = { id: number; name: string }

export async function getOwner(): Promise<Owner | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  return getSessionUser(getDb(), token, Date.now())
}

/**
 * Every admin page, server action and route handler calls this itself;
 * the admin layout's check alone does not protect actions or handlers.
 */
export async function requireOwner(): Promise<Owner> {
  const owner = await getOwner()
  if (!owner) redirect('/admin/login')
  return owner
}

/** Cookie options: Secure whenever the site is served over HTTPS. */
export function sessionCookieOptions(expiresAt: number) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: siteUrl().startsWith('https://'),
    path: '/',
    expires: new Date(expiresAt),
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  }
}

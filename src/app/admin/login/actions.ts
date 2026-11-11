'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getDb } from '@/db/client'
import { sessionCookieOptions } from '@/lib/auth/guard'
import { SESSION_COOKIE, signIn } from '@/lib/auth/sessions'

export type LoginState = { error: string | null; login: string }

/** Only admin addresses are allowed as a destination after sign-in. */
export async function safeNext(next: string | null | undefined): Promise<string> {
  return next && next.startsWith('/admin') && !next.startsWith('//') && !next.includes('\\') ? next : '/admin'
}

export async function signInAction(_prev: LoginState, form: FormData): Promise<LoginState> {
  const login = String(form.get('login') ?? '').slice(0, 200)
  const password = String(form.get('password') ?? '').slice(0, 200)
  if (!login.trim() || !password) return { error: 'Enter your login and password.', login }

  const result = await signIn(getDb(), login, password, Date.now())
  if (!result.ok) {
    return {
      error:
        result.reason === 'locked'
          ? 'Too many attempts. Please wait 15 minutes and try again.'
          : 'Wrong login or password.',
      login,
    }
  }
  ;(await cookies()).set(SESSION_COOKIE, result.token, sessionCookieOptions(result.expiresAt))
  redirect(await safeNext(String(form.get('next') ?? '')))
}

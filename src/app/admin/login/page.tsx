import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getDb } from '@/db/client'
import { getOwner } from '@/lib/auth/guard'
import { getSettings } from '@/lib/settings/settings'
import { LoginForm } from '@/components/admin/LoginForm'
import { safeNext } from './actions'

export const metadata: Metadata = { title: 'Sign in' }

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

export default async function LoginPage({ searchParams }: Props) {
  const params = await searchParams
  const rawNext = Array.isArray(params.next) ? params.next[0] : params.next
  const fromShare = rawNext === 'share'
  const next = await safeNext(rawNext)
  if (await getOwner()) redirect(next)

  const { brandName } = getSettings(getDb())
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-12">
      <p className="text-center font-display text-3xl font-semibold text-accent">{brandName}</p>
      <h1 className="mt-1 text-center text-sm text-muted">Owner sign-in</h1>
      {fromShare && (
        <p className="mt-6 rounded-md bg-accent-soft px-3 py-2 text-sm text-ink">
          Please sign in, then share the photos again.
        </p>
      )}
      <LoginForm next={next} />
    </main>
  )
}

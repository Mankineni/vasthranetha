import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getOwner } from '@/lib/auth/guard'

export const metadata: Metadata = { title: 'Shared photos' }

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

const SHARE_ID = /^[0-9a-f-]{36}$/

/** Where the service worker sends a share. The photos wait on the phone until the owner is signed in. */
export default async function ShareReceivedPage({ searchParams }: Props) {
  const raw = (await searchParams).id
  const id = Array.isArray(raw) ? raw[0] : raw
  if (!id || !SHARE_ID.test(id)) redirect('/admin/products/new')
  if (await getOwner()) redirect(`/admin/products/new?shared=${id}`)

  const next = `/admin/share/received?id=${id}`
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-12 text-center">
      <p className="text-sm text-ink">Please sign in. Your shared photos will be added after you sign in.</p>
      <Link
        href={`/admin/login?next=${encodeURIComponent(next)}`}
        className="mt-6 rounded-full bg-accent px-5 py-3 font-medium text-accent-ink"
      >
        Sign in
      </Link>
    </main>
  )
}

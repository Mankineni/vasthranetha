import Link from 'next/link'
import { getDb } from '@/db/client'
import { requireOwner } from '@/lib/auth/guard'
import { getSettings } from '@/lib/settings/settings'

export default async function AdminAppLayout({ children }: { children: React.ReactNode }) {
  const owner = await requireOwner()
  const { brandName } = getSettings(getDb())
  return (
    <>
      <header className="sticky top-0 z-30 border-b border-line bg-surface">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/admin" className="min-w-0">
            <span className="block truncate font-display text-xl font-semibold text-accent">{brandName}</span>
            <span className="block text-xs text-muted">Signed in as {owner.name}</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/" className="rounded-full px-3 py-2 text-sm text-muted hover:bg-accent-soft" target="_blank">
              View site
            </Link>
            <form action="/admin/logout" method="post">
              <button type="submit" className="rounded-full border border-line px-3 py-2 text-sm text-ink">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-28 pt-5">{children}</main>
    </>
  )
}

import type { Metadata } from 'next'
import Link from 'next/link'
import { getDb } from '@/db/client'
import { requireOwner } from '@/lib/auth/guard'
import { getPage, PAGE_SLUGS } from '@/lib/settings/pages'
import { PageTextForm } from '@/components/admin/settings/PageTextForm'

export const metadata: Metadata = { title: 'Page texts' }

const HEADINGS: Record<(typeof PAGE_SLUGS)[number], string> = {
  about: 'About us',
  'how-to-order': 'How to order',
  'shipping-returns': 'Shipping and returns',
  contact: 'Contact',
}

export default async function PagesSettingsPage() {
  await requireOwner()
  const db = getDb()
  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/settings" className="text-sm text-muted">
          ‹ Settings
        </Link>
        <h1 className="mt-1 font-display text-3xl font-semibold">Page texts</h1>
      </div>
      {PAGE_SLUGS.map((slug) => {
        const page = getPage(db, slug)
        return <PageTextForm key={slug} slug={slug} heading={HEADINGS[slug]} title={page?.title ?? HEADINGS[slug]} body={page?.body ?? ''} />
      })}
    </div>
  )
}

import type { Metadata } from 'next'
import Link from 'next/link'
import { getDb } from '@/db/client'
import { requireOwner } from '@/lib/auth/guard'
import { listPriceBands } from '@/lib/catalogue/taxonomy'
import { PriceBandEditor } from '@/components/admin/settings/PriceBandEditor'

export const metadata: Metadata = { title: 'Price bands' }

export default async function BandsSettingsPage() {
  await requireOwner()
  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/settings" className="text-sm text-muted">
          ‹ Settings
        </Link>
        <h1 className="mt-1 font-display text-3xl font-semibold">Price bands</h1>
        <p className="mt-1 text-xs text-muted">The “Shop by price” links on the home page, in this order. Both prices are included in the band.</p>
      </div>
      <PriceBandEditor initial={listPriceBands(getDb())} />
    </div>
  )
}

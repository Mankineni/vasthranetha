import type { Metadata } from 'next'
import Link from 'next/link'
import { getDb } from '@/db/client'
import { requireOwner } from '@/lib/auth/guard'
import { getSettings } from '@/lib/settings/settings'
import { BrandForm } from '@/components/admin/settings/BrandForm'
import { CustomerPhotos, ImageField } from '@/components/admin/settings/ImageField'

export const metadata: Metadata = { title: 'Brand and WhatsApp' }

export default async function BrandSettingsPage() {
  await requireOwner()
  const s = getSettings(getDb())
  return (
    <div className="space-y-8">
      <div>
        <Link href="/admin/settings" className="text-sm text-muted">
          ‹ Settings
        </Link>
        <h1 className="mt-1 font-display text-3xl font-semibold">Brand and WhatsApp</h1>
      </div>
      <BrandForm
        initial={{
          brandName: s.brandName,
          tagline: s.tagline,
          whatsappNumber: s.whatsappNumber ?? '',
          soldVisibleDays: String(s.soldVisibleDays),
        }}
      />
      <hr className="border-line" />
      <ImageField target="logo" label="Logo" hint="Square works best. Shown next to the brand name." current={s.logo} />
      <ImageField target="banner" label="Home page banner" hint="A wide photo behind the brand name on the home page." current={s.banner} />
      <CustomerPhotos photos={s.customerPhotos} />
    </div>
  )
}

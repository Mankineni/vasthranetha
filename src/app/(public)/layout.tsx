import type { Metadata } from 'next'
import { getDb } from '@/db/client'
import { listCategories } from '@/lib/catalogue/taxonomy'
import { getSettings } from '@/lib/settings/settings'
import { Footer } from '@/components/Footer'
import { Header } from '@/components/Header'
import { WhatsAppFab } from '@/components/WhatsAppFab'

// Every public page reads the database on each request (see next.config.ts).
export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const s = getSettings(getDb())
  return {
    metadataBase: new URL(process.env.SITE_URL || 'http://localhost:3000'),
    title: { default: s.tagline ? `${s.brandName} | ${s.tagline}` : s.brandName, template: `%s | ${s.brandName}` },
    description: s.tagline || `Sarees and dresses from ${s.brandName}. Order on WhatsApp.`,
    openGraph: { siteName: s.brandName, type: 'website' },
  }
}

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  const db = getDb()
  const s = getSettings(db)
  return (
    <>
      <Header brandName={s.brandName} tagline={s.tagline} logo={s.logo} categories={listCategories(db)} />
      <main className="flex-1">{children}</main>
      <Footer brandName={s.brandName} />
      <WhatsAppFab number={s.whatsappNumber} brandName={s.brandName} />
    </>
  )
}

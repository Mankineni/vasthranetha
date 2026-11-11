import type { Metadata, Viewport } from 'next'
import { RegisterServiceWorker } from '@/components/admin/RegisterServiceWorker'

// Admin pages always render per request and are never indexed or cached.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: { default: 'Admin', template: '%s | Admin' },
  robots: { index: false, follow: false },
  // Only admin pages link the manifest, so customers are never offered an "Admin" app.
  manifest: '/admin/manifest.webmanifest',
  icons: { apple: '/icons/icon-192.png' },
}

export const viewport: Viewport = { themeColor: '#7a1f2b' }

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-bg">
      <RegisterServiceWorker />
      {children}
    </div>
  )
}

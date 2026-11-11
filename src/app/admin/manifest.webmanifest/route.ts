import { getDb } from '@/db/client'
import { getSettings } from '@/lib/settings/settings'

export const dynamic = 'force-dynamic'

// Admin-only web app manifest. Scope "/admin" (no trailing slash) matches
// Next's URLs (/admin, /admin/products, ...) so start_url stays inside it.
export function GET() {
  const { brandName } = getSettings(getDb())
  const manifest = {
    id: '/admin',
    name: `${brandName} Admin`,
    short_name: `${brandName} Admin`,
    description: `Add and manage ${brandName} products`,
    start_url: '/admin',
    scope: '/admin',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#fbf7f2',
    theme_color: '#7a1f2b',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    share_target: {
      action: '/admin/share',
      method: 'POST',
      enctype: 'multipart/form-data',
      params: { files: [{ name: 'files', accept: ['image/*', 'video/mp4'] }] },
    },
  }
  return new Response(JSON.stringify(manifest), {
    headers: { 'Content-Type': 'application/manifest+json; charset=utf-8', 'Cache-Control': 'no-cache' },
  })
}

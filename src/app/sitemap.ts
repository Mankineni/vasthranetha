import type { MetadataRoute } from 'next'
import { getDb } from '@/db/client'
import { listSitemapEntries } from '@/lib/catalogue/public'
import { listCategories } from '@/lib/catalogue/taxonomy'
import { siteUrl } from '@/lib/site'

export const dynamic = 'force-dynamic'

export default function sitemap(): MetadataRoute.Sitemap {
  const db = getDb()
  const base = siteUrl()
  return [
    { url: base, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/new`, changeFrequency: 'daily', priority: 0.9 },
    ...listCategories(db).map((c) => ({ url: `${base}/c/${c.slug}`, changeFrequency: 'daily' as const, priority: 0.8 })),
    ...listSitemapEntries(db).map((p) => ({ url: `${base}${p.path}`, lastModified: new Date(p.updatedAt), priority: 0.6 })),
  ]
}

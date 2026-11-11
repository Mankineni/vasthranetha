import { eq } from 'drizzle-orm'
import type { Db } from '@/db/client'
import { pages } from '@/db/schema'

export const PAGE_SLUGS = ['about', 'how-to-order', 'shipping-returns', 'contact'] as const
export type PageSlug = (typeof PAGE_SLUGS)[number]

export type Page = { slug: string; title: string; body: string }

export function isPageSlug(slug: string): slug is PageSlug {
  return (PAGE_SLUGS as readonly string[]).includes(slug)
}

export function getPage(db: Db, slug: string): Page | null {
  return db.select().from(pages).where(eq(pages.slug, slug)).get() ?? null
}

/** Body is plain text; a blank line separates paragraphs. */
export function savePage(db: Db, slug: PageSlug, content: { title: string; body: string }): void {
  if (!isPageSlug(slug)) throw new Error(`Unknown page: ${slug}`)
  db.insert(pages)
    .values({ slug, ...content })
    .onConflictDoUpdate({ target: pages.slug, set: content })
    .run()
}

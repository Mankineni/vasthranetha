import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getDb } from '@/db/client'
import { getPage, isPageSlug } from '@/lib/settings/pages'

type Props = { params: Promise<{ page: string }> }

function load(slug: string) {
  return isPageSlug(slug) ? getPage(getDb(), slug) : null
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = load((await params).page)
  return page ? { title: page.title } : {}
}

export default async function ContentPage({ params }: Props) {
  const page = load((await params).page)
  if (!page) notFound()
  const paragraphs = page.body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
  return (
    <article className="mx-auto max-w-2xl px-4 pb-16 pt-8">
      <h1 className="font-display text-4xl font-semibold">{page.title}</h1>
      <div className="mt-6 space-y-4 leading-relaxed text-ink">
        {paragraphs.map((p, i) => (
          <p key={i} className="whitespace-pre-line">
            {p}
          </p>
        ))}
      </div>
    </article>
  )
}

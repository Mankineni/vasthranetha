import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getDb } from '@/db/client'
import { listCategories } from '@/lib/catalogue/taxonomy'
import { ListingView } from '@/components/ListingView'

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }

function findCategory(slug: string) {
  return listCategories(getDb()).find((c) => c.slug === slug)
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const cat = findCategory((await params).slug)
  return cat ? { title: cat.name, alternates: { canonical: `/c/${cat.slug}` } } : {}
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const cat = findCategory((await params).slug)
  if (!cat) notFound()
  return <ListingView title={cat.name} fixed={{ categorySlug: cat.slug }} searchParams={await searchParams} />
}

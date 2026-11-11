import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getDb } from '@/db/client'
import { listPriceBands } from '@/lib/catalogue/taxonomy'
import { ListingView } from '@/components/ListingView'

type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }

function findBand(id: string) {
  return /^\d+$/.test(id) ? listPriceBands(getDb()).find((b) => b.id === Number(id)) : undefined
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const band = findBand((await params).id)
  return band ? { title: band.label } : {}
}

export default async function PriceBandPage({ params, searchParams }: Props) {
  const band = findBand((await params).id)
  if (!band) notFound()
  return <ListingView title={band.label} fixed={{ priceBandId: band.id }} searchParams={await searchParams} />
}

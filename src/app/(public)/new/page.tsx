import type { Metadata } from 'next'
import { ListingView } from '@/components/ListingView'

export const metadata: Metadata = { title: 'New arrivals', alternates: { canonical: '/new' } }

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

export default async function NewArrivalsPage({ searchParams }: Props) {
  return <ListingView title="New arrivals" subtitle="Newest first" fixed={{}} searchParams={await searchParams} />
}

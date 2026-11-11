import type { Metadata } from 'next'
import { ListingView } from '@/components/ListingView'

export const metadata: Metadata = { title: 'Search', robots: { index: false } }

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

export default async function SearchPage({ searchParams }: Props) {
  const params = await searchParams
  const raw = Array.isArray(params.q) ? params.q[0] : params.q
  const q = raw?.trim().slice(0, 100) ?? ''

  return (
    <>
      <form action="/search" role="search" className="mx-auto max-w-6xl px-4 pt-6">
        <label htmlFor="q" className="sr-only">
          Search by name or product code
        </label>
        <div className="flex gap-2">
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={q}
            autoFocus={!q}
            placeholder="Name or code, e.g. silk or S-1042"
            className="min-w-0 flex-1 rounded-full border border-line bg-surface px-4 py-2.5 text-base"
          />
          <button type="submit" className="rounded-full bg-accent px-5 text-sm font-medium text-accent-ink">
            Search
          </button>
        </div>
      </form>
      {q ? (
        <ListingView
          title={`Results for “${q}”`}
          fixed={{ q }}
          searchParams={params}
          showFilters={false}
          emptyText="Nothing matched. Try another word, or ask us on WhatsApp."
        />
      ) : (
        <p className="mx-auto max-w-6xl px-4 py-10 text-sm text-muted">Type a name, fabric or product code.</p>
      )}
    </>
  )
}

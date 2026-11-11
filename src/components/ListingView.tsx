import { getDb } from '@/db/client'
import { requestTime } from '@/lib/clock'
import { listPublicProducts, type ListQuery } from '@/lib/catalogue/public'
import { parseListParams, toApiQuery } from '@/lib/catalogue/query'
import { listFabrics, listOccasions, listPriceBands } from '@/lib/catalogue/taxonomy'
import { FilterBar } from './FilterBar'
import { ProductGrid } from './ProductGrid'

type Props = {
  title: string
  subtitle?: string
  /** Fixed parts of the query for this page (category or price band). */
  fixed: Pick<ListQuery, 'categorySlug' | 'priceBandId' | 'q'>
  searchParams: Record<string, string | string[] | undefined>
  showFilters?: boolean
  emptyText?: string
}

export function ListingView({ title, subtitle, fixed, searchParams, showFilters = true, emptyText }: Props) {
  const db = getDb()
  const user = parseListParams(searchParams)
  const query = {
    fabricSlug: user.fabricSlug,
    occasionSlug: user.occasionSlug,
    priceBandId: fixed.priceBandId ?? user.priceBandId,
    sort: user.sort,
    ...fixed,
  }
  const { items, total } = listPublicProducts(db, { ...query, now: requestTime() })
  const apiQuery = toApiQuery(query)

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-10 pt-6">
      <h1 className="font-display text-3xl font-semibold text-ink">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      <p className="mb-4 mt-1 text-xs text-muted">
        {total} {total === 1 ? 'piece' : 'pieces'}
      </p>
      {showFilters && (
        <FilterBar
          current={{ fabric: user.fabricSlug, occasion: user.occasionSlug, band: user.priceBandId?.toString(), sort: user.sort }}
          fabrics={listFabrics(db).map((f) => ({ value: f.slug, label: f.name }))}
          occasions={listOccasions(db).map((o) => ({ value: o.slug, label: o.name }))}
          bands={
            fixed.priceBandId === undefined
              ? listPriceBands(db).map((b) => ({ value: String(b.id), label: b.label }))
              : undefined
          }
        />
      )}
      <ProductGrid key={apiQuery} initial={items} total={total} apiQuery={apiQuery} emptyText={emptyText} />
    </div>
  )
}

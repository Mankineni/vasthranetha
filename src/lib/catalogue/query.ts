import type { ListQuery } from './public'

type Params = Record<string, string | string[] | undefined> | URLSearchParams

function read(params: Params, key: string): string | undefined {
  const v = params instanceof URLSearchParams ? (params.get(key) ?? undefined) : params[key]
  const s = Array.isArray(v) ? v[0] : v
  return s && s.trim() ? s.trim().slice(0, 100) : undefined
}

const SORTS = ['newest', 'price-asc', 'price-desc'] as const

/** Turns URL parameters into a ListQuery (without `now`). Unknown values are ignored. */
export function parseListParams(params: Params): Omit<ListQuery, 'now'> {
  const band = read(params, 'band')
  const sort = read(params, 'sort')
  const offset = Number(read(params, 'offset'))
  const limit = Number(read(params, 'limit'))
  return {
    categorySlug: read(params, 'category'),
    fabricSlug: read(params, 'fabric'),
    occasionSlug: read(params, 'occasion'),
    priceBandId: band && /^\d+$/.test(band) ? Number(band) : undefined,
    q: read(params, 'q'),
    sort: SORTS.includes(sort as (typeof SORTS)[number]) ? (sort as ListQuery['sort']) : undefined,
    offset: Number.isInteger(offset) && offset > 0 ? offset : undefined,
    limit: Number.isInteger(limit) && limit > 0 ? limit : undefined,
  }
}

/** The inverse, for the grid's "load more" requests. */
export function toApiQuery(q: Omit<ListQuery, 'now' | 'offset' | 'limit'>): string {
  const p = new URLSearchParams()
  if (q.categorySlug) p.set('category', q.categorySlug)
  if (q.fabricSlug) p.set('fabric', q.fabricSlug)
  if (q.occasionSlug) p.set('occasion', q.occasionSlug)
  if (q.priceBandId !== undefined) p.set('band', String(q.priceBandId))
  if (q.q) p.set('q', q.q)
  if (q.sort) p.set('sort', q.sort)
  return p.toString()
}

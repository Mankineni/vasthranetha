'use client'

import { usePathname, useRouter } from 'next/navigation'

type Option = { value: string; label: string }

export type FilterState = { category?: string; fabric?: string; occasion?: string; band?: string; sort?: string; q?: string }

type Props = {
  current: FilterState
  /** Omitted on category pages, where the category is the page itself. */
  categories?: Option[]
  fabrics: Option[]
  occasions: Option[]
  /** Omitted on price-band pages, where the band is the page itself. */
  bands?: Option[]
}

const SORTS: Option[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'price-asc', label: 'Price: low to high' },
  { value: 'price-desc', label: 'Price: high to low' },
]

export function FilterBar({ current, categories, fabrics, occasions, bands }: Props) {
  const router = useRouter()
  const pathname = usePathname()

  function change(key: keyof FilterState, value: string) {
    const next = new URLSearchParams()
    const merged = { ...current, [key]: value }
    for (const [k, v] of Object.entries(merged)) {
      if (v && !(k === 'sort' && v === 'newest')) next.set(k, v)
    }
    const qs = next.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  const select = (key: keyof FilterState, label: string, options: Option[], all: string | null) => (
    <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-muted">
      {label}
      <select
        aria-label={label}
        value={current[key] ?? (all === null ? 'newest' : '')}
        onChange={(e) => change(key, e.target.value)}
        className="w-full min-w-0 rounded-md border border-line bg-surface px-2 py-2 text-sm text-ink"
      >
        {all !== null && <option value="">{all}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )

  return (
    <div className="mb-5 grid grid-cols-2 gap-3 sm:flex">
      {categories && categories.length > 1 && select('category', 'Category', categories, 'All categories')}
      {fabrics.length > 0 && select('fabric', 'Fabric', fabrics, 'All fabrics')}
      {occasions.length > 0 && select('occasion', 'Occasion', occasions, 'All occasions')}
      {bands && bands.length > 0 && select('band', 'Price', bands, 'Any price')}
      {select('sort', 'Sort', SORTS, null)}
    </div>
  )
}

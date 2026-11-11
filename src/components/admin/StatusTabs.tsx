import Link from 'next/link'
import type { ProductStatus } from '@/lib/catalogue/types'

type Props = { current: ProductStatus | undefined; counts: Record<ProductStatus | 'all', number>; q?: string }

const TABS: { status: ProductStatus | undefined; label: string; key: ProductStatus | 'all' }[] = [
  { status: undefined, label: 'All', key: 'all' },
  { status: 'available', label: 'Available', key: 'available' },
  { status: 'sold', label: 'Sold', key: 'sold' },
  { status: 'draft', label: 'Drafts', key: 'draft' },
]

export function StatusTabs({ current, counts, q }: Props) {
  return (
    <nav aria-label="Filter by status" className="scroll-row -mx-4 px-4">
      <ul className="flex gap-2">
        {TABS.map((t) => {
          const params = new URLSearchParams()
          if (t.status) params.set('status', t.status)
          if (q) params.set('q', q)
          const qs = params.toString()
          const active = t.status === current
          return (
            <li key={t.key}>
              <Link
                href={qs ? `/admin/products?${qs}` : '/admin/products'}
                aria-current={active ? 'page' : undefined}
                className={`block whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm ${active ? 'bg-accent text-accent-ink' : 'border border-line bg-surface text-ink'}`}
              >
                {t.label} <span className="opacity-70">{counts[t.key]}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

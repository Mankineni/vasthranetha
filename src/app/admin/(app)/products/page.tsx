import type { Metadata } from 'next'
import Link from 'next/link'
import { getDb } from '@/db/client'
import { requireOwner } from '@/lib/auth/guard'
import { listAdminProducts } from '@/lib/catalogue/admin'
import { formatPrice } from '@/lib/format'

export const metadata: Metadata = { title: 'Products' }

// Minimal list; Task 11 adds search, status tabs and one-tap actions.
export default async function ProductsPage() {
  await requireOwner()
  const products = listAdminProducts(getDb(), {})
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="font-display text-3xl font-semibold">Products</h1>
        <Link href="/admin/products/new" className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-ink">
          Add product
        </Link>
      </div>
      <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
        {products.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
            <Link href={`/admin/products/${p.id}`} className="min-w-0 truncate text-sm text-ink">
              {p.name}
            </Link>
            <span className="shrink-0 text-xs text-muted">
              {p.code} · {formatPrice(p.price)} · {p.status}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

import type { Metadata } from 'next'
import Link from 'next/link'
import { getDb } from '@/db/client'
import { requireOwner } from '@/lib/auth/guard'
import { countByStatus, listAdminProducts } from '@/lib/catalogue/admin'
import { productPath } from '@/lib/catalogue/codes'
import type { ProductStatus } from '@/lib/catalogue/types'
import { variantAtLeast } from '@/lib/media/urls'
import { absoluteUrl } from '@/lib/site'
import { ProductRow, type RowProduct } from '@/components/admin/ProductRow'
import { StatusTabs } from '@/components/admin/StatusTabs'

export const metadata: Metadata = { title: 'Products' }

const LIMIT = 200
const STATUSES: ProductStatus[] = ['available', 'sold', 'draft']

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

export default async function ProductsPage({ searchParams }: Props) {
  await requireOwner()
  const params = await searchParams
  const rawStatus = first(params.status)
  const status = STATUSES.find((s) => s === rawStatus)
  const q = first(params.q)?.trim().slice(0, 100) || undefined

  const db = getDb()
  const products = listAdminProducts(db, { q, status, limit: LIMIT })
  const rows: RowProduct[] = products.map((p) => {
    const cover = p.media.find((m) => m.kind === 'photo')
    return {
      id: p.id,
      code: p.code,
      name: p.name,
      price: p.price,
      status: p.status,
      thumb: cover ? variantAtLeast(cover, 480) : null,
      publicUrl: p.status === 'draft' ? null : absoluteUrl(productPath(p)),
    }
  })

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-semibold">Products</h1>
        <Link href="/admin/products/new" className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-ink">
          Add product
        </Link>
      </div>
      <form role="search" action="/admin/products" className="mb-3">
        {status && <input type="hidden" name="status" value={status} />}
        <input
          type="search"
          name="q"
          defaultValue={q}
          aria-label="Search products"
          placeholder="Search by name or code"
          className="w-full rounded-full border border-line bg-surface px-4 py-2.5 text-base"
        />
      </form>
      <StatusTabs current={status} counts={countByStatus(db)} q={q} />
      {rows.length ? (
        <ul className="mt-4 divide-y divide-line rounded-lg border border-line bg-surface">
          {rows.map((p) => (
            <ProductRow key={p.id} p={p} />
          ))}
        </ul>
      ) : (
        <p className="mt-10 text-center text-sm text-muted">{q ? 'No products match your search.' : 'No products here yet.'}</p>
      )}
      {rows.length === LIMIT && (
        <p className="mt-3 text-center text-xs text-muted">Showing the newest {LIMIT}. Search to find older products.</p>
      )}
    </div>
  )
}

'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { duplicate, markAvailable, markSold, removeProduct } from '@/app/admin/(app)/products/actions'
import { formatPrice } from '@/lib/format'
import type { ProductStatus } from '@/lib/catalogue/types'
import { safely } from './safeAction'

export type RowProduct = {
  id: number
  code: string
  name: string
  price: number
  status: ProductStatus
  thumb: string | null
  /** Absolute public address; null for drafts. */
  publicUrl: string | null
}

const BADGE: Record<ProductStatus, { label: string; className: string }> = {
  available: { label: 'Available', className: 'bg-whatsapp/15 text-whatsapp' },
  sold: { label: 'Sold', className: 'bg-ink text-white' },
  draft: { label: 'Draft', className: 'bg-line text-muted' },
}

export function ProductRow({ p }: { p: RowProduct }) {
  const [pending, startTransition] = useTransition()
  const [menu, setMenu] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const badge = BADGE[p.status]

  // A lost connection becomes a message on the row, not an error page.
  const run = (fn: () => Promise<unknown>) =>
    startTransition(async () => {
      setError(null)
      const result = (await safely(fn)) as { error?: string | null } | undefined
      if (result?.error) setError(result.error)
    })

  async function copyLink() {
    if (!p.publicUrl) return
    try {
      await navigator.clipboard.writeText(p.publicUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt('Copy this link', p.publicUrl)
    }
  }

  async function share() {
    if (!p.publicUrl) return
    if (navigator.share) {
      try {
        await navigator.share({ title: p.name, url: p.publicUrl })
        return
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return
      }
    }
    await copyLink()
  }

  function remove() {
    if (!window.confirm('Delete this product? This cannot be undone.')) return
    setMenu(false)
    run(() => removeProduct(p.id))
  }

  const menuItem = 'block w-full px-4 py-2.5 text-left text-sm text-ink hover:bg-accent-soft disabled:opacity-50'

  return (
    <li data-testid={`row-${p.code}`} className={`relative flex gap-3 px-3 py-3 ${pending ? 'opacity-60' : ''}`}>
      <Link href={`/admin/products/${p.id}`} className="h-[72px] w-[54px] shrink-0 overflow-hidden rounded bg-accent-soft">
        {p.thumb && (
          // eslint-disable-next-line @next/next/no-img-element -- stored thumbnail
          <img src={p.thumb} alt="" loading="lazy" className="h-full w-full object-cover" />
        )}
      </Link>
      <div className="min-w-0 flex-1">
        <Link href={`/admin/products/${p.id}`} className="line-clamp-2 text-sm font-medium text-ink">
          {p.name}
        </Link>
        <p className="mt-0.5 text-xs text-muted">
          {p.code} · {formatPrice(p.price)}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}>{badge.label}</span>
          {p.status === 'available' && (
            <button
              type="button"
              data-testid="mark-sold"
              disabled={pending}
              onClick={() => run(() => markSold(p.id))}
              className="rounded-full border border-ink px-3 py-1 text-xs font-medium text-ink"
            >
              Mark sold
            </button>
          )}
          {p.status === 'sold' && (
            <button
              type="button"
              data-testid="mark-available"
              disabled={pending}
              onClick={() => run(() => markAvailable(p.id))}
              className="rounded-full border border-whatsapp px-3 py-1 text-xs font-medium text-whatsapp"
            >
              Mark available
            </button>
          )}
          <Link data-testid="edit" href={`/admin/products/${p.id}`} className="rounded-full border border-line px-3 py-1 text-xs text-ink">
            Edit
          </Link>
        </div>
        {error && <p className="mt-1 text-xs text-danger">{error}</p>}
      </div>
      <div className="relative shrink-0">
        <button
          type="button"
          aria-label="More actions"
          aria-expanded={menu}
          onClick={() => setMenu((m) => !m)}
          className="flex h-9 w-9 items-center justify-center rounded-full text-lg text-ink hover:bg-accent-soft"
        >
          ⋯
        </button>
        {menu && (
          <div className="absolute right-0 top-10 z-20 w-44 overflow-hidden rounded-md border border-line bg-surface py-1 shadow-lg">
            <button type="button" data-testid="duplicate" disabled={pending} className={menuItem} onClick={() => run(() => duplicate(p.id))}>
              Duplicate
            </button>
            {p.publicUrl && (
              <>
                <button type="button" data-testid="copy-link" className={menuItem} onClick={copyLink}>
                  {copied ? 'Copied' : 'Copy link'}
                </button>
                <button type="button" data-testid="share" className={menuItem} onClick={share}>
                  Share
                </button>
              </>
            )}
            <button type="button" data-testid="delete" disabled={pending} className={`${menuItem} text-danger`} onClick={remove}>
              Delete
            </button>
          </div>
        )}
      </div>
    </li>
  )
}

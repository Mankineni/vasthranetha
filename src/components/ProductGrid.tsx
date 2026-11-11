'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { PublicCard } from '@/lib/catalogue/public'
import { ProductCard } from './ProductCard'

type Props = {
  initial: PublicCard[]
  total: number
  /** Query string for /api/products without offset, e.g. "category=sarees&sort=newest". */
  apiQuery: string
  emptyText?: string
}

/** Product grid that loads the next 24 when its end scrolls into view. */
export function ProductGrid({ initial, total, apiQuery, emptyText = 'Nothing here yet. Please check back soon.' }: Props) {
  const [items, setItems] = useState(initial)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const end = useRef<HTMLDivElement>(null)
  const hasMore = items.length < total

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return
    setLoading(true)
    setFailed(false)
    try {
      const sep = apiQuery ? '&' : ''
      const res = await fetch(`/api/products?${apiQuery}${sep}offset=${items.length}`)
      if (!res.ok) throw new Error(String(res.status))
      const data: { items: PublicCard[] } = await res.json()
      setItems((prev) => {
        const seen = new Set(prev.map((p) => p.code))
        return [...prev, ...data.items.filter((p) => !seen.has(p.code))]
      })
    } catch {
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }, [apiQuery, hasMore, items.length, loading])

  useEffect(() => {
    const el = end.current
    if (!el || !hasMore) return
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && loadMore(), {
      rootMargin: '400px 0px',
    })
    io.observe(el)
    return () => io.disconnect()
  }, [hasMore, loadMore])

  if (!items.length) return <p className="py-16 text-center text-muted">{emptyText}</p>

  return (
    <>
      <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((card, i) => (
          <ProductCard key={card.code} card={card} priority={i < 2} />
        ))}
      </div>
      <div ref={end} data-testid="grid-end" className="flex min-h-12 items-center justify-center py-6 text-sm text-muted">
        {loading && 'Loading more…'}
        {failed && (
          <button type="button" onClick={loadMore} className="rounded-full border border-line px-4 py-2 text-ink">
            Could not load more. Try again
          </button>
        )}
        {!hasMore && items.length > 8 && 'You have seen everything here.'}
      </div>
    </>
  )
}

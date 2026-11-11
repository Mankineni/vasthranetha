'use client' // Error boundaries must be Client Components

import Link from 'next/link'
import { useEffect } from 'react'

/** Shown instead of a blank page when an admin screen fails unexpectedly. */
export default function AdminError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="py-16 text-center">
      <p className="font-display text-3xl font-semibold text-accent">Something went wrong</p>
      <p className="mt-3 text-sm text-muted">
        This screen could not load. Check your connection and try again. Nothing you saved earlier is lost.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={() => retry()} className="rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-accent-ink">
          Try again
        </button>
        <Link href="/admin/products" className="rounded-full border border-line px-5 py-2.5 text-sm text-ink">
          Products
        </Link>
      </div>
    </div>
  )
}

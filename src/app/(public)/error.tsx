'use client' // Error boundaries must be Client Components

import Link from 'next/link'
import { useEffect } from 'react'

/** Friendly page for unexpected errors on the shop (spec 6.9). */
export default function PublicError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center px-4 py-24 text-center">
      <p className="font-display text-4xl font-semibold text-accent">Something went wrong</p>
      <p className="mt-4 text-muted">This page could not load just now. Please try again in a moment.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={() => retry()} className="rounded-full border border-line px-6 py-3 text-sm font-medium text-ink">
          Try again
        </button>
        <Link href="/new" className="rounded-full bg-accent px-6 py-3 text-sm font-medium text-accent-ink">
          See new arrivals
        </Link>
      </div>
    </div>
  )
}

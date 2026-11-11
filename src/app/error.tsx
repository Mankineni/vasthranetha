'use client' // Error boundaries must be Client Components

import Link from 'next/link'
import { useEffect } from 'react'

/** Catches failures in the shop's own layout (the per-section error pages sit inside it). */
export default function RootError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center px-4 py-24 text-center">
      <p className="font-display text-4xl font-semibold text-accent">Something went wrong</p>
      <p className="mt-4 text-muted">The site could not load just now. Please try again in a moment.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={() => retry()} className="rounded-full border border-line px-6 py-3 text-sm font-medium text-ink">
          Try again
        </button>
        <Link href="/new" className="rounded-full bg-accent px-6 py-3 text-sm font-medium text-accent-ink">
          See new arrivals
        </Link>
      </div>
    </main>
  )
}

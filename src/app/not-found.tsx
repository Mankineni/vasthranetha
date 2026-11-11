import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center px-4 py-24 text-center">
      <p className="font-display text-5xl font-semibold text-accent">Not found</p>
      <p className="mt-4 text-muted">This page is not here. The piece may have been removed, or the link is mistyped.</p>
      <Link href="/new" className="mt-8 rounded-full bg-accent px-6 py-3 text-sm font-medium text-accent-ink">
        See new arrivals
      </Link>
    </main>
  )
}

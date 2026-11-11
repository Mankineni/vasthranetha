import Link from 'next/link'
import type { Category } from '@/lib/catalogue/taxonomy'
import { mediaUrl } from '@/lib/media/urls'

type Props = { brandName: string; tagline: string; logo: string | null; categories: Category[] }

export function Header({ brandName, tagline, logo, categories }: Props) {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="flex min-w-0 items-center gap-2" aria-label={`${brandName} home`}>
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element -- small site image served from /media
            <img src={mediaUrl(logo)} alt="" className="h-9 w-9 rounded-full object-cover" />
          ) : null}
          <span className="min-w-0">
            <span className="block truncate font-display text-2xl font-semibold leading-none text-accent">
              {brandName}
            </span>
            {tagline && <span className="mt-0.5 hidden truncate text-xs text-muted sm:block">{tagline}</span>}
          </span>
        </Link>
        <Link
          href="/search"
          aria-label="Search"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink hover:bg-accent-soft"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
        </Link>
      </div>
      <nav aria-label="Categories" className="scroll-row mx-auto max-w-6xl">
        <ul className="flex gap-2 px-4 pb-3 text-sm">
          <li>
            <Link href="/new" className="block whitespace-nowrap rounded-full bg-accent px-3.5 py-1.5 text-accent-ink">
              New arrivals
            </Link>
          </li>
          {categories.map((c) => (
            <li key={c.id}>
              <Link
                href={`/c/${c.slug}`}
                className="block whitespace-nowrap rounded-full border border-line bg-surface px-3.5 py-1.5 text-ink"
              >
                {c.name}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  )
}

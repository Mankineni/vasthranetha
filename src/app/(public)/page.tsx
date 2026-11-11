import Link from 'next/link'
import { getDb } from '@/db/client'
import { listPublicProducts } from '@/lib/catalogue/public'
import { requestTime } from '@/lib/clock'
import { listCategories, listPriceBands } from '@/lib/catalogue/taxonomy'
import { mediaUrl } from '@/lib/media/urls'
import { getSettings } from '@/lib/settings/settings'
import { ProductCard } from '@/components/ProductCard'
import { ResponsiveImage } from '@/components/ResponsiveImage'

const STEPS = [
  { title: 'Pick a piece', text: 'Browse new arrivals and tap the one you like.' },
  { title: 'Order on WhatsApp', text: 'Tap the order button. Your message names the piece for us.' },
  { title: 'Pay and relax', text: 'We confirm availability, share payment details and ship it to you.' },
]

export default function HomePage() {
  const db = getDb()
  const now = requestTime()
  const s = getSettings(db)
  const newest = listPublicProducts(db, { now, limit: 12 }).items
  const categories = listCategories(db).map((c) => ({
    ...c,
    cover: c.tileImage ? null : (listPublicProducts(db, { now, categorySlug: c.slug, limit: 1 }).items[0]?.cover ?? null),
  }))
  const bands = listPriceBands(db)

  return (
    <div className="mx-auto w-full max-w-6xl px-4">
      <section className="relative mt-4 overflow-hidden rounded-xl bg-accent text-accent-ink">
        {s.banner && (
          // eslint-disable-next-line @next/next/no-img-element -- site banner served from /media
          <img src={mediaUrl(s.banner)} alt="" className="absolute inset-0 h-full w-full object-cover opacity-60" />
        )}
        <div className="relative px-6 py-10 sm:py-16">
          <p className="text-xs uppercase tracking-[0.2em] text-accent-ink/80">New pieces every day</p>
          <h1 className="mt-2 font-display text-4xl font-semibold leading-tight sm:text-5xl">{s.brandName}</h1>
          {s.tagline && <p className="mt-2 max-w-md text-sm text-accent-ink/90">{s.tagline}</p>}
          <Link href="/new" className="mt-6 inline-block rounded-full bg-surface px-5 py-2.5 text-sm font-medium text-accent">
            Shop new arrivals
          </Link>
        </div>
      </section>

      <section data-testid="new-arrivals" className="mt-10">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="font-display text-2xl font-semibold">New arrivals</h2>
          <Link href="/new" className="text-sm text-accent">
            See all
          </Link>
        </div>
        {newest.length ? (
          <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
            {newest.map((card, i) => (
              <ProductCard key={card.code} card={card} priority={i < 2} />
            ))}
          </div>
        ) : (
          <p className="text-muted">New pieces are coming soon.</p>
        )}
      </section>

      {categories.length > 0 && (
        <section data-testid="category-tiles" className="mt-12">
          <h2 className="mb-4 font-display text-2xl font-semibold">Shop by category</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {categories.map((c) => (
              <Link key={c.id} href={`/c/${c.slug}`} className="group relative block aspect-[4/5] overflow-hidden rounded-lg bg-accent-soft">
                {c.tileImage ? (
                  // eslint-disable-next-line @next/next/no-img-element -- tile image served from /media
                  <img src={mediaUrl(c.tileImage)} alt="" className="h-full w-full object-cover" />
                ) : c.cover ? (
                  <ResponsiveImage media={c.cover} alt="" sizes="(min-width: 640px) 25vw, 50vw" className="h-full w-full object-cover" />
                ) : null}
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3 pb-3 pt-10 font-display text-xl font-semibold text-white">
                  {c.name}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {bands.length > 0 && (
        <section data-testid="price-bands" className="mt-12">
          <h2 className="mb-4 font-display text-2xl font-semibold">Shop by price</h2>
          <div className="flex flex-wrap gap-2">
            {bands.map((b) => (
              <Link key={b.id} href={`/price/${b.id}`} className="rounded-full border border-line bg-surface px-4 py-2 text-sm text-ink hover:border-accent">
                {b.label}
              </Link>
            ))}
          </div>
        </section>
      )}

      <section data-testid="how-to-order" className="mt-12 rounded-xl border border-line bg-surface p-6">
        <h2 className="font-display text-2xl font-semibold">How ordering works</h2>
        <ol className="mt-4 grid gap-4 sm:grid-cols-3">
          {STEPS.map((step, i) => (
            <li key={step.title} className="flex gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft font-semibold text-accent">
                {i + 1}
              </span>
              <span>
                <span className="block font-medium">{step.title}</span>
                <span className="block text-sm text-muted">{step.text}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-8 text-sm text-muted">
        <p>
          We ship across India. Problems with an order? Message us within 48 hours of delivery.{' '}
          <Link href="/shipping-returns" className="text-accent underline">
            Shipping and returns
          </Link>
        </p>
      </section>

      {s.customerPhotos.length > 0 && (
        <section data-testid="customer-photos" className="mb-4 mt-12">
          <h2 className="mb-4 font-display text-2xl font-semibold">Our customers</h2>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {s.customerPhotos.map((p) => (
              // eslint-disable-next-line @next/next/no-img-element -- customer photo served from /media
              <img key={p} src={mediaUrl(p)} alt="A happy customer" loading="lazy" className="aspect-square w-full rounded-md object-cover" />
            ))}
          </div>
        </section>
      )}
      <div className="h-12" />
    </div>
  )
}

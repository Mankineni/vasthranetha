import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, permanentRedirect } from 'next/navigation'
import { getDb } from '@/db/client'
import { parseProductPath } from '@/lib/catalogue/codes'
import { getPublicProduct, relatedProducts, type PublicProduct } from '@/lib/catalogue/public'
import { formatPrice } from '@/lib/format'
import { largestVariant, mediaUrl, previewSize } from '@/lib/media/urls'
import { getSettings } from '@/lib/settings/settings'
import { absoluteUrl } from '@/lib/site'
import { Gallery } from '@/components/Gallery'
import { OrderPanel } from '@/components/OrderPanel'
import { ProductCard } from '@/components/ProductCard'
import { ShareButton } from '@/components/ShareButton'

type Props = { params: Promise<{ slug: string }> }

function load(segment: string): PublicProduct | null {
  const parsed = parseProductPath(segment)
  return parsed ? getPublicProduct(getDb(), parsed.code) : null
}

function summary(p: PublicProduct): string {
  const parts = [formatPrice(p.price), p.fabric?.name ?? p.category.name]
  if (p.sold) parts.push('Sold')
  return `${parts.join(' · ')}. Order on WhatsApp.`
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = load((await params).slug)
  if (!p) return {}
  const brand = getSettings(getDb()).brandName
  const cover = p.cover
  const images =
    cover?.previewPath != null
      ? [{ url: absoluteUrl(mediaUrl(cover.previewPath)), ...previewSize(cover), alt: p.name }]
      : []
  return {
    title: p.name,
    description: summary(p),
    alternates: { canonical: p.path },
    openGraph: {
      title: p.name,
      description: summary(p),
      url: absoluteUrl(p.path),
      siteName: brand,
      type: 'website',
      images,
    },
    twitter: { card: 'summary_large_image', title: p.name, description: summary(p) },
  }
}

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <div className="flex gap-4 border-b border-line py-2.5 text-sm last:border-0">
      <dt className="w-28 shrink-0 text-muted">{label}</dt>
      <dd className="text-ink">{value}</dd>
    </div>
  )
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params
  const p = load(slug)
  if (!p) notFound()
  // Old names, upper-case codes and missing names all land on one address.
  if (`/p/${slug}` !== p.path) permanentRedirect(p.path)

  const db = getDb()
  const settings = getSettings(db)
  const related = relatedProducts(db, p.code)
  const url = absoluteUrl(p.path)
  const biggest = p.cover ? largestVariant(p.cover) : null

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    sku: p.code,
    image: biggest ? [absoluteUrl(biggest)] : undefined,
    description: p.description || summary(p),
    category: p.category.name,
    brand: { '@type': 'Brand', name: settings.brandName },
    offers: {
      '@type': 'Offer',
      url,
      price: String(p.price),
      priceCurrency: 'INR',
      availability: p.sold ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock',
    },
  }

  const blouse = p.blousePiece === null ? null : p.blousePiece ? 'Included' : 'Not included'
  const paragraphs = p.description.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean)

  return (
    <div className="mx-auto w-full max-w-6xl pb-12 sm:px-4 sm:pt-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <nav aria-label="Breadcrumb" className="hidden px-4 pb-3 text-xs text-muted sm:block sm:px-0">
        <Link href="/">Home</Link> / <Link href={`/c/${p.category.slug}`}>{p.category.name}</Link>
      </nav>

      <div className="lg:grid lg:grid-cols-12 lg:gap-10">
        <div className="lg:col-span-7">
          <Gallery photos={p.photos} video={p.video} name={p.name} sold={p.sold} />
        </div>

        <div className="px-4 pt-5 sm:px-0 lg:col-span-5 lg:pt-0">
          {p.sold && (
            <span data-testid="sold-label" className="mb-3 inline-block rounded-full bg-ink px-3 py-1 text-xs font-medium tracking-wide text-white">
              Sold
            </span>
          )}
          <h1 className="font-display text-3xl font-semibold leading-tight text-ink">{p.name}</h1>
          <p data-testid="price" className="mt-2 text-2xl font-semibold text-ink">
            {formatPrice(p.price)}
          </p>
          <p className="mt-1 text-xs text-muted">Code: {p.code}</p>

          <OrderPanel
            number={settings.whatsappNumber}
            product={{ name: p.name, code: p.code, price: p.price, sizes: p.sizes, colours: p.colours, sold: p.sold }}
            url={url}
          />

          <div className="mt-4 flex justify-center">
            <ShareButton title={p.name} url={url} />
          </div>

          <dl data-testid="details" className="mt-8">
            <Detail label="Fabric" value={p.fabric?.name} />
            <Detail label="Occasion" value={p.occasions.map((o) => o.name).join(', ')} />
            <Detail label="Length" value={p.length} />
            <Detail label="Blouse piece" value={blouse} />
            <Detail label="Care" value={p.care} />
          </dl>
          {paragraphs.length > 0 && (
            <div className="mt-6 space-y-3 text-sm leading-relaxed text-ink">
              {paragraphs.map((text, i) => (
                <p key={i} className="whitespace-pre-line">
                  {text}
                </p>
              ))}
            </div>
          )}
          <p className="mt-6 rounded-md bg-surface p-4 text-xs leading-relaxed text-muted">
            Colours can look slightly different on each screen. We ship across India; see{' '}
            <Link href="/shipping-returns" className="text-accent underline">
              shipping and returns
            </Link>
            .
          </p>
        </div>
      </div>

      {related.length > 0 && (
        <section data-testid="related" className="mt-14 px-4 sm:px-0">
          <h2 className="mb-4 font-display text-2xl font-semibold">More like this</h2>
          <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-4">
            {related.map((card) => (
              <ProductCard key={card.code} card={card} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

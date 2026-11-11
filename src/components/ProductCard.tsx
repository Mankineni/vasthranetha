import Link from 'next/link'
import type { PublicCard } from '@/lib/catalogue/public'
import { formatPrice } from '@/lib/format'
import { ResponsiveImage } from './ResponsiveImage'

export function ProductCard({ card, priority }: { card: PublicCard; priority?: boolean }) {
  return (
    <Link href={card.path} data-testid="product-card" className="group block">
      <div className="relative aspect-[3/4] overflow-hidden rounded-md bg-accent-soft">
        {card.cover && (
          <ResponsiveImage
            media={card.cover}
            alt={card.name}
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            priority={priority}
            className={`h-full w-full object-cover transition duration-300 group-hover:scale-[1.02] ${card.sold ? 'opacity-60' : ''}`}
          />
        )}
        {card.sold && (
          <span className="absolute left-2 top-2 rounded-full bg-ink/85 px-2.5 py-0.5 text-xs font-medium tracking-wide text-white">
            Sold
          </span>
        )}
      </div>
      <div className="mt-2 px-0.5">
        <p className="line-clamp-2 text-sm leading-snug text-ink">{card.name}</p>
        <p className="mt-0.5 text-sm font-semibold text-ink">{formatPrice(card.price)}</p>
      </div>
    </Link>
  )
}

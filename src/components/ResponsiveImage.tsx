import type { MediaItem } from '@/lib/catalogue/types'
import { srcSetOf, variantAtLeast } from '@/lib/media/urls'

type Props = {
  media: Pick<MediaItem, 'width' | 'height' | 'variants'>
  alt: string
  sizes: string
  priority?: boolean
  className?: string
}

/** Plain <img> with every stored variant in srcset; the browser picks the size for the screen. */
export function ResponsiveImage({ media, alt, sizes, priority, className }: Props) {
  const src = variantAtLeast(media, 960)
  if (!src) return null
  return (
    // eslint-disable-next-line @next/next/no-img-element -- variants are pre-generated; next/image would re-encode them
    <img
      src={src}
      srcSet={srcSetOf(media)}
      sizes={sizes}
      width={media.width || undefined}
      height={media.height || undefined}
      alt={alt}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : undefined}
      decoding="async"
      className={className}
    />
  )
}

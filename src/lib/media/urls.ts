// Browser-safe helpers for media URLs (no Node imports).
import type { MediaItem } from '@/lib/catalogue/types'

export function mediaUrl(p: string): string {
  return `/media/${p}`
}

type Sized = Pick<MediaItem, 'width' | 'height' | 'variants'>

/** Real pixel width of a variant whose long side is `longSide`. */
function pixelWidth(m: Sized, longSide: number): number {
  const long = Math.max(m.width, m.height) || longSide
  return Math.round((m.width || longSide) * (longSide / long))
}

export function srcSetOf(m: Sized): string {
  return m.variants.map((v) => `${mediaUrl(v.path)} ${pixelWidth(m, v.width)}w`).join(', ')
}

/** The smallest variant at least `minLongSide` on its long side, else the largest. */
export function variantAtLeast(m: Sized, minLongSide: number): string | null {
  if (!m.variants.length) return null
  const sorted = [...m.variants].sort((a, b) => a.width - b.width)
  return mediaUrl((sorted.find((v) => v.width >= minLongSide) ?? sorted[sorted.length - 1]).path)
}

export function largestVariant(m: Sized): string | null {
  if (!m.variants.length) return null
  return mediaUrl([...m.variants].sort((a, b) => b.width - a.width)[0].path)
}

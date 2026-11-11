import sharp from 'sharp'

/** Long-side widths of the display versions. */
export const DISPLAY_WIDTHS = [480, 960, 1600, 2400]
/** Photos below this long side get a "may look soft" warning. */
export const LOW_RES_LIMIT = 1200
const PREVIEW_LONG_SIDE = 1200
const WEBP_QUALITY = 90
const PREVIEW_QUALITY = 85

/** Long sides to generate: every listed width that fits, plus the original's own size when below the largest. */
export function variantWidths(longSide: number): number[] {
  const widths = DISPLAY_WIDTHS.filter((w) => w <= longSide)
  const largest = DISPLAY_WIDTHS[DISPLAY_WIDTHS.length - 1]
  if (longSide < largest && !widths.includes(longSide)) widths.push(longSide)
  return widths
}

function resized(buf: Buffer, longSide: number) {
  return sharp(buf)
    .rotate()
    .resize({ width: longSide, height: longSide, fit: 'inside', withoutEnlargement: true })
    .toColourspace('srgb')
}

/** Width/height are after applying the camera orientation. A variant's `width` is its long side. */
export async function processPhoto(buf: Buffer): Promise<{
  width: number
  height: number
  variants: { width: number; data: Buffer }[]
  preview: Buffer
}> {
  const meta = await sharp(buf).metadata()
  const rawW = meta.width ?? 0
  const rawH = meta.height ?? 0
  // EXIF orientations 5 to 8 rotate the picture by 90 degrees.
  const swapped = (meta.orientation ?? 1) >= 5
  const width = swapped ? rawH : rawW
  const height = swapped ? rawW : rawH
  const longSide = Math.max(width, height)

  // smartSubsample keeps thin zari threads and saturated reds from smearing; it measured
  // about 27% less colour error on such detail for about 5% more bytes.
  const variants = await Promise.all(
    variantWidths(longSide).map(async (w) => ({
      width: w,
      data: await resized(buf, w).webp({ quality: WEBP_QUALITY, smartSubsample: true }).toBuffer(),
    })),
  )
  const preview = await resized(buf, Math.min(PREVIEW_LONG_SIDE, longSide))
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: PREVIEW_QUALITY, mozjpeg: true })
    .toBuffer()
  return { width, height, variants, preview }
}

import { largestVariant, previewSize, srcSetOf, variantAtLeast } from '@/lib/media/urls'

const portrait = {
  width: 1800,
  height: 2400,
  variants: [
    { width: 480, path: 'ab/h-480.webp' },
    { width: 960, path: 'ab/h-960.webp' },
    { width: 1600, path: 'ab/h-1600.webp' },
    { width: 2400, path: 'ab/h-2400.webp' },
  ],
}

test('srcset uses real pixel widths, not long sides', () => {
  expect(srcSetOf(portrait)).toBe(
    '/media/ab/h-480.webp 360w, /media/ab/h-960.webp 720w, /media/ab/h-1600.webp 1200w, /media/ab/h-2400.webp 1800w',
  )
})

test('variant picking', () => {
  expect(variantAtLeast(portrait, 900)).toBe('/media/ab/h-960.webp')
  expect(variantAtLeast(portrait, 5000)).toBe('/media/ab/h-2400.webp')
  expect(largestVariant(portrait)).toBe('/media/ab/h-2400.webp')
  expect(largestVariant({ width: 0, height: 0, variants: [] })).toBeNull()
})

test('preview size matches the stored preview JPEG (long side at most 1200)', () => {
  expect(previewSize(portrait)).toEqual({ width: 900, height: 1200 })
  expect(previewSize({ width: 2000, height: 1000 })).toEqual({ width: 1200, height: 600 })
  expect(previewSize({ width: 300, height: 400 })).toEqual({ width: 300, height: 400 })
})

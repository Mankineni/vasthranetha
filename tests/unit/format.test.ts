import { formatPrice } from '@/lib/format'

test('formatPrice uses Indian grouping', () => {
  expect(formatPrice(125000)).toBe('₹1,25,000')
  expect(formatPrice(1850)).toBe('₹1,850')
  expect(formatPrice(999)).toBe('₹999')
})

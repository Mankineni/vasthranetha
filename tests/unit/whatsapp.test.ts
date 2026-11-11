import {
  buildGreetingMessage,
  buildOrderMessage,
  buildSimilarMessage,
  buildWhatsAppLink,
  normaliseWhatsAppNumber,
} from '@/lib/whatsapp/message'

const base = { name: 'Maroon Soft Silk', code: 'S-1042', price: 1850, url: 'https://x.test/p/s-1042-maroon-soft-silk' }

test('order message matches the spec layout', () => {
  expect(buildOrderMessage(base)).toBe(
    "Hi! I'd like to order this:\nMaroon Soft Silk\nCode: S-1042\nPrice: ₹1,850\nhttps://x.test/p/s-1042-maroon-soft-silk",
  )
})

test('size and colour lines appear only when given, size before colour', () => {
  expect(buildOrderMessage({ ...base, size: 'M', colour: 'Teal' })).toBe(
    "Hi! I'd like to order this:\nMaroon Soft Silk\nCode: S-1042\nPrice: ₹1,850\nSize: M\nColour: Teal\nhttps://x.test/p/s-1042-maroon-soft-silk",
  )
  expect(buildOrderMessage({ ...base, colour: 'Teal' })).not.toContain('Size:')
})

test('name with emoji, Telugu text, & and # survives the link round trip', () => {
  const msg = buildOrderMessage({ name: 'పట్టు చీర 🌸 Red & Gold #1', code: 'S-1', price: 999, url: 'https://x.test/p/s-1' })
  const link = buildWhatsAppLink('919876543210', msg)
  expect(link.startsWith('https://wa.me/919876543210?text=')).toBe(true)
  expect(new URL(link).searchParams.get('text')).toBe(msg)
})

test('a line break inside a product name is flattened to a space', () => {
  const msg = buildOrderMessage({ ...base, name: 'Maroon\nSoft  Silk' })
  expect(msg.split('\n')[1]).toBe('Maroon Soft Silk')
})

test('greeting and similar-product messages', () => {
  expect(buildGreetingMessage('Boutique')).toBe('Hi! I have a question about Boutique.')
  expect(buildSimilarMessage(base)).toBe(
    'Hi! This one is sold. Do you have something similar?\nMaroon Soft Silk\nCode: S-1042\nhttps://x.test/p/s-1042-maroon-soft-silk',
  )
})

test.each([
  ['+91 98765 43210', '919876543210'],
  ['098765 43210', '919876543210'],
  ['9876543210', '919876543210'],
  ['919876543210', '919876543210'],
  ['0091 98765 43210', '919876543210'],
  ['+91 0 98765 43210', '919876543210'],
  ['+91-6000-123456', '916000123456'],
  ['091 98765 43210', '919876543210'],
  ['+091 98765 43210', '919876543210'],
  ['0919876543210', '919876543210'],
  ['12345', null],
  ['', null],
  ['abc', null],
  // Indian mobile numbers start with 6, 7, 8 or 9; anything else would leave every order link dead.
  ['1234567890', null],
  ['5876543210', null],
  ['+91 1234567890', null],
  ['+44 7911 123456', null],
])('normaliseWhatsAppNumber(%s) → %s', (input, out) => {
  expect(normaliseWhatsAppNumber(input)).toBe(out)
})

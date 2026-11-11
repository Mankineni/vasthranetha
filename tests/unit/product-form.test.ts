import {
  emptyForm,
  fromAdminProduct,
  marginOf,
  orderMediaIds,
  parsePayload,
  parsePrice,
  payloadToInput,
  type ProductPayload,
} from '@/lib/catalogue/form'
import type { AdminProduct } from '@/lib/catalogue/types'

test.each([
  ['1450', 1450],
  [' 1,450 ', 1450],
  ['₹1,25,000', 125000],
  ['Rs. 999', 999],
  ['', NaN],
  ['12.50', NaN],
  ['abc', NaN],
  ['-5', NaN],
])('parsePrice(%j) → %s', (input, out) => {
  expect(parsePrice(input)).toBe(out)
})

test('margin is shown only when both prices are valid', () => {
  expect(marginOf('1450', '1100')).toBe(350)
  expect(marginOf('1000', '1100')).toBe(-100)
  expect(marginOf('1450', '')).toBeNull()
  expect(marginOf('', '1100')).toBeNull()
})

test('empty form defaults to the given category', () => {
  expect(emptyForm(3)).toMatchObject({ name: '', price: '', categoryId: '3', fabricId: '', blousePiece: '', sizes: [] })
})

function payload(values: Partial<ProductPayload['values']> = {}): ProductPayload {
  return { id: null, intent: 'publish', submitToken: 'tok-123456', mediaIds: [4, 5], values: { ...emptyForm(1), ...values } }
}

test('payloadToInput converts typed text into catalogue input', () => {
  const input = payloadToInput(
    payload({
      name: '  Teal Cotton ',
      price: '1,450',
      fabricId: '2',
      occasionIds: [1, 3],
      blousePiece: 'yes',
      dealerPrice: '1100',
      sizes: ['M', 'L'],
      colours: ['Teal'],
    }),
  )
  expect(input).toMatchObject({
    name: '  Teal Cotton ',
    price: 1450,
    categoryId: 1,
    fabricId: 2,
    occasionIds: [1, 3],
    blousePiece: true,
    dealerPrice: 1100,
    sizes: ['M', 'L'],
    colours: ['Teal'],
    mediaIds: [4, 5],
    submitToken: 'tok-123456',
  })
  expect(payloadToInput(payload({ blousePiece: 'no' })).blousePiece).toBe(false)
  expect(payloadToInput(payload({ blousePiece: '' })).blousePiece).toBeNull()
  expect(payloadToInput(payload({ fabricId: '' })).fabricId).toBeNull()
  expect(payloadToInput(payload({ dealerPrice: '' })).dealerPrice).toBeNull()
  expect(payloadToInput(payload({ dealerPrice: 'abc' })).dealerPrice).toBeNaN()
})

test('parsePayload accepts a well-formed payload and rejects anything else', () => {
  const good = payload()
  expect(parsePayload(JSON.parse(JSON.stringify(good)))).toEqual(good)
  expect(parsePayload(null)).toBeNull()
  expect(parsePayload({ ...good, intent: 'delete' })).toBeNull()
  expect(parsePayload({ ...good, mediaIds: ['1'] })).toBeNull()
  expect(parsePayload({ ...good, values: { ...good.values, name: 5 } })).toBeNull()
  expect(parsePayload({ ...good, submitToken: '' })).toBeNull()
})

test('media ids go photos first, then the video, keeping the photo order', () => {
  expect(
    orderMediaIds([
      { id: 9, kind: 'video' },
      { id: 2, kind: 'photo' },
      { id: 7, kind: 'photo' },
    ]),
  ).toEqual([2, 7, 9])
})

test('fromAdminProduct turns a stored product back into form text', () => {
  const p = {
    name: 'Red Silk',
    price: 2400,
    categoryId: 2,
    fabricId: null,
    occasionIds: [1],
    length: '6.3 m',
    blousePiece: false,
    care: '',
    description: 'Nice',
    sizes: [],
    colours: ['Red'],
    dealerName: 'Ravi',
    dealerCode: 'R1',
    dealerPrice: 1800,
    notes: '',
  } as unknown as AdminProduct
  expect(fromAdminProduct(p)).toEqual({
    name: 'Red Silk',
    price: '2400',
    categoryId: '2',
    fabricId: '',
    occasionIds: [1],
    length: '6.3 m',
    blousePiece: 'no',
    care: '',
    description: 'Nice',
    sizes: [],
    colours: ['Red'],
    dealerName: 'Ravi',
    dealerCode: 'R1',
    dealerPrice: '1800',
    notes: '',
  })
})

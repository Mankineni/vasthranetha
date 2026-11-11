// Sample catalogue used by `npm run seed` and by the browser tests, which
// assert against these facts. Plain data only, so tests can import it.

export const SEED_BRAND = 'Boutique'
export const SEED_TAGLINE = 'Sarees and dresses, handpicked for you'
export const SEED_WHATSAPP = '919999999999'

export const SEED_CATEGORIES = [
  { name: 'Sarees', codePrefix: 'S' },
  { name: 'Dresses', codePrefix: 'D' },
]
export const SEED_FABRICS = ['Soft silk', 'Cotton', 'Georgette', 'Chiffon', 'Banarasi', 'Linen']
export const SEED_OCCASIONS = ['Wedding', 'Festive', 'Office', 'Daily wear', 'Party']
export const SEED_BANDS = [
  { label: 'Under ₹999', min: 0, max: 999 },
  { label: '₹1,000 to ₹2,499', min: 1000, max: 2499 },
  { label: '₹2,500 and above', min: 2500, max: null },
]

export type SeedProduct = {
  name: string
  category: 'Sarees' | 'Dresses'
  price: number
  fabric: string
  occasions: string[]
  colour: string // hex, used to draw the sample photos
  daysAgo: number // published this many days before seeding
  photos: number
  state?: 'draft' | { soldDaysAgo: number }
  sizes?: string[]
  length?: string
  blousePiece?: boolean
  care?: string
  description?: string
}

const SAREE = { length: '6.3 m', blousePiece: true, care: 'Dry clean only' }
const DRESS_SIZES = ['S', 'M', 'L', 'XL']

export const SEED_PRODUCTS: SeedProduct[] = [
  { ...SAREE, name: 'Maroon Soft Silk Saree', category: 'Sarees', price: 1850, fabric: 'Soft silk', occasions: ['Wedding', 'Festive'], colour: '#7a1f2b', daysAgo: 0, photos: 4, description: 'Rich maroon soft silk with a gold zari border.' },
  { ...SAREE, name: 'Mint Handloom Cotton Saree', category: 'Sarees', price: 749, fabric: 'Cotton', occasions: ['Daily wear', 'Office'], colour: '#9fd8c3', daysAgo: 1, photos: 3 },
  { ...SAREE, name: 'Mustard Cotton Saree', category: 'Sarees', price: 899, fabric: 'Cotton', occasions: ['Daily wear'], colour: '#d9a520', daysAgo: 1, photos: 2 },
  { ...SAREE, name: 'Indigo Block Print Cotton Saree', category: 'Sarees', price: 1199, fabric: 'Cotton', occasions: ['Office'], colour: '#2d3f7c', daysAgo: 2, photos: 3 },
  { ...SAREE, name: 'Ruby Banarasi Silk Saree', category: 'Sarees', price: 4999, fabric: 'Banarasi', occasions: ['Wedding'], colour: '#a3122a', daysAgo: 3, photos: 4, state: { soldDaysAgo: 2 } },
  { ...SAREE, name: 'Emerald Banarasi Saree', category: 'Sarees', price: 3899, fabric: 'Banarasi', occasions: ['Wedding', 'Festive'], colour: '#0f6b4a', daysAgo: 3, photos: 4 },
  { ...SAREE, name: 'Blush Georgette Saree', category: 'Sarees', price: 1499, fabric: 'Georgette', occasions: ['Party'], colour: '#e8b4b8', daysAgo: 4, photos: 3 },
  { ...SAREE, name: 'Black Sequin Georgette Saree', category: 'Sarees', price: 2299, fabric: 'Georgette', occasions: ['Party'], colour: '#1d1b1f', daysAgo: 4, photos: 3 },
  { ...SAREE, name: 'Lavender Chiffon Saree', category: 'Sarees', price: 1299, fabric: 'Chiffon', occasions: ['Party', 'Festive'], colour: '#b9a3d6', daysAgo: 5, photos: 2 },
  { ...SAREE, name: 'Sky Blue Chiffon Saree', category: 'Sarees', price: 1099, fabric: 'Chiffon', occasions: ['Office'], colour: '#8cc4e8', daysAgo: 5, photos: 2 },
  { ...SAREE, name: 'Ivory Linen Saree', category: 'Sarees', price: 1699, fabric: 'Linen', occasions: ['Office'], colour: '#efe8d8', daysAgo: 12, photos: 2, state: { soldDaysAgo: 10 } },
  { ...SAREE, name: 'Rust Linen Saree', category: 'Sarees', price: 1799, fabric: 'Linen', occasions: ['Office', 'Daily wear'], colour: '#b5502b', daysAgo: 6, photos: 3 },
  { ...SAREE, name: 'Peacock Soft Silk Saree', category: 'Sarees', price: 2499, fabric: 'Soft silk', occasions: ['Festive'], colour: '#11607a', daysAgo: 6, photos: 4 },
  { ...SAREE, name: 'Gold Tissue Soft Silk Saree', category: 'Sarees', price: 2999, fabric: 'Soft silk', occasions: ['Wedding'], colour: '#c9a646', daysAgo: 7, photos: 3 },
  { ...SAREE, name: 'Magenta Soft Silk Saree', category: 'Sarees', price: 2199, fabric: 'Soft silk', occasions: ['Festive', 'Party'], colour: '#a01a6b', daysAgo: 7, photos: 3 },
  { ...SAREE, name: 'Olive Soft Silk Saree', category: 'Sarees', price: 1999, fabric: 'Soft silk', occasions: ['Festive'], colour: '#6b6b2a', daysAgo: 8, photos: 2 },
  { ...SAREE, name: 'Coral Georgette Saree', category: 'Sarees', price: 1399, fabric: 'Georgette', occasions: ['Party'], colour: '#ef7d63', daysAgo: 8, photos: 2 },
  { ...SAREE, name: 'Teal Banarasi Saree', category: 'Sarees', price: 3499, fabric: 'Banarasi', occasions: ['Wedding'], colour: '#14706f', daysAgo: 9, photos: 3 },
  { ...SAREE, name: 'Wine Chiffon Saree', category: 'Sarees', price: 1599, fabric: 'Chiffon', occasions: ['Party'], colour: '#5c1a33', daysAgo: 9, photos: 2 },
  { ...SAREE, name: 'Peach Georgette Saree', category: 'Sarees', price: 1349, fabric: 'Georgette', occasions: ['Festive'], colour: '#f4b98e', daysAgo: 0, photos: 2, state: 'draft' },

  { name: 'Teal Cotton Anarkali Dress', category: 'Dresses', price: 1650, fabric: 'Cotton', occasions: ['Festive'], colour: '#1b7c7a', daysAgo: 0, photos: 3, sizes: DRESS_SIZES, care: 'Hand wash cold' },
  { name: 'Yellow Floral Maxi Dress', category: 'Dresses', price: 1299, fabric: 'Georgette', occasions: ['Party'], colour: '#e9c53a', daysAgo: 1, photos: 3, sizes: DRESS_SIZES },
  { name: 'Navy Linen Shirt Dress', category: 'Dresses', price: 1499, fabric: 'Linen', occasions: ['Office'], colour: '#23314f', daysAgo: 2, photos: 2, sizes: DRESS_SIZES, state: { soldDaysAgo: 1 } },
  { name: 'Red Silk Kurta Set', category: 'Dresses', price: 2399, fabric: 'Soft silk', occasions: ['Festive', 'Wedding'], colour: '#b01c2e', daysAgo: 2, photos: 3, sizes: DRESS_SIZES },
  { name: 'White Chikankari Kurta', category: 'Dresses', price: 999, fabric: 'Cotton', occasions: ['Daily wear'], colour: '#f2f0ea', daysAgo: 3, photos: 2, sizes: DRESS_SIZES },
  { name: 'Pink Chiffon Gown', category: 'Dresses', price: 2799, fabric: 'Chiffon', occasions: ['Party'], colour: '#e77fa6', daysAgo: 4, photos: 3, sizes: DRESS_SIZES },
  { name: 'Green Printed Cotton Dress', category: 'Dresses', price: 849, fabric: 'Cotton', occasions: ['Daily wear'], colour: '#4c8b3a', daysAgo: 5, photos: 2, sizes: DRESS_SIZES },
  { name: 'Maroon Velvet Kurta', category: 'Dresses', price: 1899, fabric: 'Soft silk', occasions: ['Festive'], colour: '#5e1424', daysAgo: 6, photos: 2, sizes: DRESS_SIZES },
  { name: 'Lilac Georgette Sharara Set', category: 'Dresses', price: 2599, fabric: 'Georgette', occasions: ['Wedding', 'Party'], colour: '#c3a6d9', daysAgo: 7, photos: 3, sizes: DRESS_SIZES },
  { name: 'Black Linen Co-ord Set', category: 'Dresses', price: 1599, fabric: 'Linen', occasions: ['Office'], colour: '#222222', daysAgo: 1, photos: 2, sizes: DRESS_SIZES, state: 'draft' },
]

export const SEED_PAGES = {
  about: {
    title: 'About us',
    body: 'We are two friends who love sarees and dresses.\n\nFor years we have helped customers on WhatsApp find the right piece for every occasion. This website lets you browse our latest collection any time.',
  },
  'how-to-order': {
    title: 'How to order',
    body: 'Find a piece you like and tap "Check availability & order on WhatsApp".\n\nWe confirm availability with you on WhatsApp and share the payment details.\n\nOnce paid, your order is packed and shipped to your address.',
  },
  'shipping-returns': {
    title: 'Shipping and returns',
    body: 'We ship across India. Delivery usually takes 4 to 7 working days.\n\nIf there is a problem with your order, message us on WhatsApp within 48 hours of delivery with a photo and we will help.',
  },
  contact: {
    title: 'Contact',
    body: 'The quickest way to reach us is WhatsApp. We usually reply within a few hours.',
  },
} as const

// Facts the browser tests rely on.
export const listedSeed = SEED_PRODUCTS.filter(
  (p) => p.state !== 'draft' && !(typeof p.state === 'object' && p.state.soldDaysAgo > 7),
)

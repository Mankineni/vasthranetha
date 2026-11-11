// Translation between the product form (text the owner types) and catalogue
// input (numbers and lists). Browser-safe: used by the form and the server action.
import type { AdminProduct, ProductInput } from './types'

export type FormValues = {
  name: string
  price: string
  categoryId: string
  fabricId: string
  occasionIds: number[]
  length: string
  blousePiece: '' | 'yes' | 'no'
  care: string
  description: string
  sizes: string[]
  colours: string[]
  dealerName: string
  dealerCode: string
  dealerPrice: string
  notes: string
}

export type ProductIntent = 'publish' | 'draft' | 'save'

export type ProductPayload = {
  /** null for a new product. */
  id: number | null
  intent: ProductIntent
  submitToken: string
  mediaIds: number[]
  values: FormValues
}

export function emptyForm(categoryId: number | null): FormValues {
  return {
    name: '',
    price: '',
    categoryId: categoryId === null ? '' : String(categoryId),
    fabricId: '',
    occasionIds: [],
    length: '',
    blousePiece: '',
    care: '',
    description: '',
    sizes: [],
    colours: [],
    dealerName: '',
    dealerCode: '',
    dealerPrice: '',
    notes: '',
  }
}

export function fromAdminProduct(p: AdminProduct): FormValues {
  return {
    name: p.name,
    price: String(p.price),
    categoryId: String(p.categoryId),
    fabricId: p.fabricId === null ? '' : String(p.fabricId),
    occasionIds: [...p.occasionIds],
    length: p.length,
    blousePiece: p.blousePiece === null ? '' : p.blousePiece ? 'yes' : 'no',
    care: p.care,
    description: p.description,
    sizes: [...p.sizes],
    colours: [...p.colours],
    dealerName: p.dealerName,
    dealerCode: p.dealerCode,
    dealerPrice: p.dealerPrice === null ? '' : String(p.dealerPrice),
    notes: p.notes,
  }
}

/** Whole rupees from what people type ("1,450", "₹1450", "Rs. 1450"); NaN if it is not one. */
export function parsePrice(text: string): number {
  const digits = text.replace(/₹|rs\.?|inr|,|\s/gi, '')
  return /^\d+$/.test(digits) ? Number(digits) : NaN
}

export function marginOf(price: string, dealerPrice: string): number | null {
  const p = parsePrice(price)
  const d = parsePrice(dealerPrice)
  return Number.isNaN(p) || Number.isNaN(d) ? null : p - d
}

/** Photos first in their order, then the video. */
export function orderMediaIds(items: { id: number; kind: 'photo' | 'video' }[]): number[] {
  return [...items.filter((m) => m.kind === 'photo'), ...items.filter((m) => m.kind === 'video')].map((m) => m.id)
}

export function payloadToInput(p: ProductPayload): ProductInput {
  const v = p.values
  const optionalId = (s: string) => (s === '' ? null : Number(s))
  return {
    name: v.name,
    price: parsePrice(v.price),
    categoryId: Number(v.categoryId),
    fabricId: optionalId(v.fabricId),
    occasionIds: v.occasionIds,
    length: v.length,
    blousePiece: v.blousePiece === '' ? null : v.blousePiece === 'yes',
    care: v.care,
    description: v.description,
    sizes: v.sizes,
    colours: v.colours,
    dealerName: v.dealerName,
    dealerCode: v.dealerCode,
    dealerPrice: v.dealerPrice.trim() === '' ? null : parsePrice(v.dealerPrice),
    notes: v.notes,
    mediaIds: p.mediaIds,
    submitToken: p.submitToken,
  }
}

const isStr = (x: unknown): x is string => typeof x === 'string'
const isIntList = (x: unknown): x is number[] => Array.isArray(x) && x.every((n) => Number.isInteger(n))
const isStrList = (x: unknown): x is string[] => Array.isArray(x) && x.every(isStr)

/** Shape check for the JSON the form sends; null if anything is off. */
export function parsePayload(raw: unknown): ProductPayload | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const v = r.values as Record<string, unknown> | undefined
  if (r.id !== null && !Number.isInteger(r.id)) return null
  if (r.intent !== 'publish' && r.intent !== 'draft' && r.intent !== 'save') return null
  if (!isStr(r.submitToken) || r.submitToken.length < 8 || r.submitToken.length > 100) return null
  if (!isIntList(r.mediaIds) || !v || typeof v !== 'object') return null
  const textKeys = [
    'name', 'price', 'categoryId', 'fabricId', 'length', 'care', 'description', 'dealerName', 'dealerCode', 'dealerPrice', 'notes',
  ] as const
  for (const k of textKeys) if (!isStr(v[k]) || (v[k] as string).length > 5000) return null
  if (v.blousePiece !== '' && v.blousePiece !== 'yes' && v.blousePiece !== 'no') return null
  if (!isIntList(v.occasionIds) || !isStrList(v.sizes) || !isStrList(v.colours)) return null
  return {
    id: r.id as number | null,
    intent: r.intent,
    submitToken: r.submitToken,
    mediaIds: r.mediaIds,
    values: {
      name: v.name as string,
      price: v.price as string,
      categoryId: v.categoryId as string,
      fabricId: v.fabricId as string,
      occasionIds: v.occasionIds,
      length: v.length as string,
      blousePiece: v.blousePiece,
      care: v.care as string,
      description: v.description as string,
      sizes: v.sizes.slice(0, 30).map((s) => s.slice(0, 40)),
      colours: v.colours.slice(0, 30).map((s) => s.slice(0, 40)),
      dealerName: v.dealerName as string,
      dealerCode: v.dealerCode as string,
      dealerPrice: v.dealerPrice as string,
      notes: v.notes as string,
    },
  }
}

// "Fill for me" suggestions: checking what the model returned and applying it
// to the product form. Browser-safe (no SDK import).
import { parsePrice, type FormValues } from '@/lib/catalogue/form'

export type Suggestion = {
  name?: string
  fabric?: string
  length?: string
  blousePiece?: boolean
  description?: string
  dealerPrice?: number
}

const text = (v: unknown, max: number): string | undefined => {
  if (typeof v !== 'string') return undefined
  const t = v.trim().slice(0, max).trim()
  return t || undefined
}

function blouse(v: unknown): boolean | undefined {
  if (typeof v === 'boolean') return v
  if (typeof v !== 'string') return undefined
  const s = v.trim().toLowerCase()
  if (['included', 'yes', 'true'].includes(s)) return true
  if (['not included', 'no', 'false'].includes(s)) return false
  return undefined
}

function price(v: unknown): number | undefined {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? parsePrice(v) : NaN
  return Number.isInteger(n) && n > 0 ? n : undefined
}

/** Keeps only known fields with usable values; a fabric must be one of the stored names. */
export function parseSuggestion(raw: unknown, fabricNames: string[]): Suggestion {
  if (!raw || typeof raw !== 'object') return {}
  const r = raw as Record<string, unknown>
  const fabricText = text(r.fabric, 60)?.toLowerCase()
  const s: Suggestion = {
    name: text(r.name, 120),
    fabric: fabricText ? fabricNames.find((f) => f.toLowerCase() === fabricText) : undefined,
    length: text(r.length, 40),
    blousePiece: blouse(r.blousePiece),
    description: text(r.description, 1000),
    dealerPrice: price(r.dealerPrice),
  }
  return Object.fromEntries(Object.entries(s).filter(([, v]) => v !== undefined)) as Suggestion
}

/** Fills only empty fields. The selling price is always the owner's own decision. */
export function applySuggestion(current: FormValues, s: Suggestion, fabrics: { id: number; name: string }[]): FormValues {
  const next = { ...current }
  if (!next.name.trim() && s.name) next.name = s.name
  if (!next.length.trim() && s.length) next.length = s.length
  if (!next.description.trim() && s.description) next.description = s.description
  if (!next.fabricId && s.fabric) {
    const match = fabrics.find((f) => f.name === s.fabric)
    if (match) next.fabricId = String(match.id)
  }
  if (next.blousePiece === '' && s.blousePiece !== undefined) next.blousePiece = s.blousePiece ? 'yes' : 'no'
  if (!next.dealerPrice.trim() && s.dealerPrice) next.dealerPrice = String(s.dealerPrice)
  return next
}

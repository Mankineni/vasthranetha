import { inArray } from 'drizzle-orm'
import type { Db } from '@/db/client'
import { settings } from '@/db/schema'
import { normaliseWhatsAppNumber } from '@/lib/whatsapp/message'

export type Settings = {
  brandName: string
  tagline: string
  logo: string | null
  banner: string | null
  whatsappNumber: string | null
  soldVisibleDays: number
  customerPhotos: string[]
}

export const DEFAULT_SETTINGS: Settings = {
  brandName: 'Boutique',
  tagline: '',
  logo: null,
  banner: null,
  whatsappNumber: null,
  soldVisibleDays: 7,
  customerPhotos: [],
}

const KEYS = Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]

export function getSettings(db: Db): Settings {
  const rows = db.select().from(settings).where(inArray(settings.key, KEYS)).all()
  const result: Settings = { ...DEFAULT_SETTINGS, customerPhotos: [...DEFAULT_SETTINGS.customerPhotos] }
  for (const row of rows) {
    ;(result as Record<string, unknown>)[row.key] = JSON.parse(row.value)
  }
  return result
}

export function updateSettings(
  db: Db,
  patch: Partial<Settings>,
): { ok: true } | { ok: false; error: string } {
  const clean: Partial<Settings> = { ...patch }

  if ('whatsappNumber' in patch && patch.whatsappNumber !== null && patch.whatsappNumber !== undefined) {
    if (patch.whatsappNumber.trim() === '') {
      clean.whatsappNumber = null
    } else {
      const n = normaliseWhatsAppNumber(patch.whatsappNumber)
      if (!n) return { ok: false, error: 'Enter a valid Indian mobile number.' }
      clean.whatsappNumber = n
    }
  }
  if (patch.soldVisibleDays !== undefined) {
    const d = patch.soldVisibleDays
    if (!Number.isInteger(d) || d < 0 || d > 90) {
      return { ok: false, error: 'Days must be a whole number from 0 to 90.' }
    }
  }
  if (patch.brandName !== undefined && patch.brandName.trim() === '') {
    return { ok: false, error: 'Brand name cannot be empty.' }
  }

  db.transaction((tx) => {
    for (const key of KEYS) {
      if (!(key in clean) || clean[key] === undefined) continue
      const value = JSON.stringify(clean[key])
      tx.insert(settings).values({ key, value }).onConflictDoUpdate({ target: settings.key, set: { value } }).run()
    }
  })
  return { ok: true }
}

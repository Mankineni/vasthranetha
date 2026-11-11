'use server'

import { revalidatePath } from 'next/cache'
import { getDb } from '@/db/client'
import { requireOwner } from '@/lib/auth/guard'
import {
  createCategory,
  createFabric,
  createOccasion,
  deleteCategory,
  deleteFabric,
  deleteOccasion,
  listCategories,
  listFabrics,
  listOccasions,
  savePriceBands,
  updateCategory,
} from '@/lib/catalogue/taxonomy'
import { isPageSlug, savePage } from '@/lib/settings/pages'
import { getSettings, updateSettings } from '@/lib/settings/settings'

export type ActionResult = { ok: boolean; error: string | null; version: number }

const done = (version: number): ActionResult => ({ ok: true, error: null, version: version + 1 })
const failed = (version: number, error: string): ActionResult => ({ ok: false, error, version })
const text = (form: FormData, key: string, max = 200) => String(form.get(key) ?? '').slice(0, max)

function refresh() {
  revalidatePath('/admin/settings', 'layout')
}

// --- brand and WhatsApp ---

export type BrandState = ActionResult & {
  values: { brandName: string; tagline: string; whatsappNumber: string; soldVisibleDays: string }
}

export async function saveBrand(prev: BrandState, form: FormData): Promise<BrandState> {
  await requireOwner()
  const values = {
    brandName: text(form, 'brandName', 80),
    tagline: text(form, 'tagline', 160),
    whatsappNumber: text(form, 'whatsappNumber', 30),
    soldVisibleDays: text(form, 'soldVisibleDays', 4),
  }
  const days = /^\d+$/.test(values.soldVisibleDays.trim()) ? Number(values.soldVisibleDays) : NaN
  const result = updateSettings(getDb(), {
    brandName: values.brandName.trim(),
    tagline: values.tagline.trim(),
    whatsappNumber: values.whatsappNumber.trim() === '' ? null : values.whatsappNumber,
    soldVisibleDays: days,
  })
  if (!result.ok) return { ...failed(prev.version, result.error), values }
  refresh()
  const s = getSettings(getDb())
  return {
    ...done(prev.version),
    values: {
      brandName: s.brandName,
      tagline: s.tagline,
      whatsappNumber: s.whatsappNumber ?? '',
      soldVisibleDays: String(s.soldVisibleDays),
    },
  }
}

export async function clearSiteImage(target: 'logo' | 'banner'): Promise<void> {
  await requireOwner()
  updateSettings(getDb(), target === 'logo' ? { logo: null } : { banner: null })
  refresh()
}

export async function removeCustomerPhoto(path: string): Promise<void> {
  await requireOwner()
  const db = getDb()
  updateSettings(db, { customerPhotos: getSettings(db).customerPhotos.filter((p) => p !== path) })
  refresh()
}

// --- categories ---

export async function addCategory(prev: ActionResult, form: FormData): Promise<ActionResult> {
  await requireOwner()
  const r = createCategory(getDb(), { name: text(form, 'name', 60), codePrefix: text(form, 'codePrefix', 3) })
  if (!r.ok) return failed(prev.version, r.error)
  refresh()
  return done(prev.version)
}

export async function saveCategory(id: number, prev: ActionResult, form: FormData): Promise<ActionResult> {
  await requireOwner()
  const r = updateCategory(getDb(), id, { name: text(form, 'name', 60), codePrefix: text(form, 'codePrefix', 3) })
  if (!r.ok) return failed(prev.version, r.error)
  refresh()
  return done(prev.version)
}

export async function moveCategory(id: number, delta: -1 | 1): Promise<void> {
  await requireOwner()
  const db = getDb()
  const list = listCategories(db)
  const from = list.findIndex((c) => c.id === id)
  const to = from + delta
  if (from < 0 || to < 0 || to >= list.length) return
  list.splice(to, 0, ...list.splice(from, 1))
  list.forEach((c, position) => updateCategory(db, c.id, { position }))
  refresh()
}

export async function removeCategoryTile(id: number): Promise<void> {
  await requireOwner()
  updateCategory(getDb(), id, { tileImage: null })
  refresh()
}

const inUse = (name: string) => `${name} is used by products and cannot be deleted.`

export async function removeCategory(id: number): Promise<{ error: string | null }> {
  await requireOwner()
  const db = getDb()
  const name = listCategories(db).find((c) => c.id === id)?.name ?? 'This category'
  const r = deleteCategory(db, id)
  if (!r.ok) return { error: r.error === 'in use' ? inUse(name) : r.error }
  refresh()
  return { error: null }
}

// --- fabrics and occasions ---

export async function addListItem(kind: 'fabric' | 'occasion', prev: ActionResult, form: FormData): Promise<ActionResult> {
  await requireOwner()
  const name = text(form, 'name', 60)
  const r = kind === 'fabric' ? createFabric(getDb(), name) : createOccasion(getDb(), name)
  if (!r.ok) return failed(prev.version, r.error)
  refresh()
  return done(prev.version)
}

export async function removeListItem(kind: 'fabric' | 'occasion', id: number): Promise<{ error: string | null }> {
  await requireOwner()
  const db = getDb()
  const list = kind === 'fabric' ? listFabrics(db) : listOccasions(db)
  const name = list.find((x) => x.id === id)?.name ?? 'This item'
  const r = kind === 'fabric' ? deleteFabric(db, id) : deleteOccasion(db, id)
  if (!r.ok) return { error: r.error === 'in use' ? inUse(name) : r.error }
  refresh()
  return { error: null }
}

// --- price bands ---

export async function saveBands(
  bands: { id?: number; label: string; min: string; max: string }[],
): Promise<{ ok: boolean; error: string | null }> {
  await requireOwner()
  const parsed = []
  for (const b of bands.slice(0, 12)) {
    const min = b.min.trim() === '' ? 0 : /^\d+$/.test(b.min.trim()) ? Number(b.min) : NaN
    const max = b.max.trim() === '' ? null : /^\d+$/.test(b.max.trim()) ? Number(b.max) : NaN
    if (Number.isNaN(min) || Number.isNaN(max)) return { ok: false, error: 'Prices must be whole rupees.' }
    parsed.push({ id: Number.isInteger(b.id) ? b.id : undefined, label: b.label.slice(0, 60), min, max })
  }
  const r = savePriceBands(getDb(), parsed)
  if (!r.ok) return { ok: false, error: r.error }
  refresh()
  return { ok: true, error: null }
}

// --- page texts ---

export async function savePageText(slug: string, prev: ActionResult, form: FormData): Promise<ActionResult> {
  await requireOwner()
  if (!isPageSlug(slug)) return failed(prev.version, 'Unknown page.')
  const title = text(form, 'title', 120).trim()
  const body = text(form, 'body', 20_000).replace(/\r\n/g, '\n').trim()
  if (!title) return failed(prev.version, 'Enter a title.')
  savePage(getDb(), slug, { title, body })
  refresh()
  return done(prev.version)
}

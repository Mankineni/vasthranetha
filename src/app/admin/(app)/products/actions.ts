'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getDb } from '@/db/client'
import { requireOwner } from '@/lib/auth/guard'
import {
  createProduct,
  duplicateProduct,
  getAdminProduct,
  ProductError,
  setStatus,
  updateProduct,
  validateProductInput,
} from '@/lib/catalogue/admin'
import { parsePayload, payloadToInput } from '@/lib/catalogue/form'
import { deleteProductAndFiles } from '@/lib/catalogue/remove'
import { mediaDirFromEnv } from '@/lib/media/store'

export type SaveState = { errors: string[] }

export async function saveProduct(_prev: SaveState, form: FormData): Promise<SaveState> {
  const owner = await requireOwner()
  let raw: unknown
  try {
    raw = JSON.parse(String(form.get('payload') ?? ''))
  } catch {
    raw = null
  }
  const payload = parsePayload(raw)
  if (!payload) return { errors: ['Something went wrong. Please reload the page and try again.'] }

  const db = getDb()
  const input = payloadToInput(payload)
  const now = Date.now()
  try {
    if (payload.id === null) {
      const errors = validateProductInput(input, payload.intent === 'publish')
      if (errors.length) return { errors }
      createProduct(db, input, owner.id, { publish: payload.intent === 'publish', now })
    } else {
      const current = getAdminProduct(db, payload.id)
      if (!current) return { errors: ['This product no longer exists.'] }
      const publishing = current.status === 'draft' && payload.intent === 'publish'
      const errors = validateProductInput(input, current.status !== 'draft' || publishing)
      if (errors.length) return { errors }
      updateProduct(db, payload.id, input, owner.id, now)
      if (publishing) setStatus(db, payload.id, 'available', owner.id, now)
    }
  } catch (err) {
    if (err instanceof ProductError) return { errors: [err.message] }
    throw err
  }
  redirect('/admin/products')
}

/** Deletes a product and its files; the list re-renders without it. */
export async function removeProduct(id: number): Promise<void> {
  await requireOwner()
  if (!Number.isInteger(id)) return
  await deleteProductAndFiles(getDb(), id, mediaDirFromEnv())
  revalidatePath('/admin/products')
}

async function changeStatus(id: number, status: 'available' | 'sold'): Promise<{ error: string | null }> {
  const owner = await requireOwner()
  if (!Number.isInteger(id)) return { error: 'Unknown product.' }
  try {
    setStatus(getDb(), id, status, owner.id, Date.now())
  } catch (err) {
    if (err instanceof ProductError) return { error: err.message }
    throw err
  }
  revalidatePath('/admin/products')
  return { error: null }
}

export async function markSold(id: number) {
  return changeStatus(id, 'sold')
}

export async function markAvailable(id: number) {
  return changeStatus(id, 'available')
}

/** Copies a product (without photos) as a new draft and opens it. */
export async function duplicate(id: number): Promise<void> {
  const owner = await requireOwner()
  if (!Number.isInteger(id)) return
  const copy = duplicateProduct(getDb(), id, owner.id, Date.now())
  redirect(`/admin/products/${copy.id}`)
}

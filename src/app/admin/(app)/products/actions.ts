'use server'

import { redirect } from 'next/navigation'
import { getDb } from '@/db/client'
import { requireOwner } from '@/lib/auth/guard'
import {
  createProduct,
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

export async function removeProduct(id: number): Promise<void> {
  await requireOwner()
  if (!Number.isInteger(id)) return
  await deleteProductAndFiles(getDb(), id, mediaDirFromEnv())
  redirect('/admin/products')
}

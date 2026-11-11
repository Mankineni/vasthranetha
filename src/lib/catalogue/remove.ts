import { eq } from 'drizzle-orm'
import type { Db } from '@/db/client'
import { media } from '@/db/schema'
import { deleteMediaRows } from '@/lib/media/store'
import { deleteProduct } from './admin'

/** Deletes a product and every file of its media that no other product still uses. */
export async function deleteProductAndFiles(db: Db, id: number, mediaDir: string): Promise<void> {
  const ids = db.select({ id: media.id }).from(media).where(eq(media.productId, id)).all().map((r) => r.id)
  await deleteMediaRows(db, ids, mediaDir)
  deleteProduct(db, id)
}

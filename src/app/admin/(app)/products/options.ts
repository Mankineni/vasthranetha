import type { Db } from '@/db/client'
import { listCategories, listFabrics, listOccasions } from '@/lib/catalogue/taxonomy'

/** Choice lists for the product form. */
export function formOptions(db: Db) {
  const pick = (rows: { id: number; name: string }[]) => rows.map(({ id, name }) => ({ id, name }))
  return {
    categories: pick(listCategories(db)),
    fabrics: pick(listFabrics(db)),
    occasions: pick(listOccasions(db)),
  }
}

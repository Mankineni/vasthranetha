import type { Metadata } from 'next'
import Link from 'next/link'
import { getDb } from '@/db/client'
import { requireOwner } from '@/lib/auth/guard'
import { listCategories, listFabrics, listOccasions } from '@/lib/catalogue/taxonomy'
import { CategoryEditor } from '@/components/admin/settings/CategoryEditor'
import { NamedListEditor } from '@/components/admin/settings/NamedListEditor'

export const metadata: Metadata = { title: 'Categories and lists' }

export default async function ListsSettingsPage() {
  await requireOwner()
  const db = getDb()
  return (
    <div className="space-y-10">
      <div>
        <Link href="/admin/settings" className="text-sm text-muted">
          ‹ Settings
        </Link>
        <h1 className="mt-1 font-display text-3xl font-semibold">Categories and lists</h1>
      </div>
      <CategoryEditor categories={listCategories(db).map(({ id, name, codePrefix, tileImage }) => ({ id, name, codePrefix, tileImage }))} />
      <NamedListEditor kind="fabric" title="Fabrics" placeholder="e.g. Organza" items={listFabrics(db)} />
      <NamedListEditor kind="occasion" title="Occasions" placeholder="e.g. Haldi" items={listOccasions(db)} />
    </div>
  )
}

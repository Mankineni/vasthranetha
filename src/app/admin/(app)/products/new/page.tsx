import { randomUUID } from 'node:crypto'
import type { Metadata } from 'next'
import { getDb } from '@/db/client'
import { requireOwner } from '@/lib/auth/guard'
import { emptyForm } from '@/lib/catalogue/form'
import { listBatch } from '@/lib/media/store'
import { ProductForm } from '@/components/admin/ProductForm'
import { formOptions } from '../options'

export const metadata: Metadata = { title: 'Add product' }

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

export default async function NewProductPage({ searchParams }: Props) {
  await requireOwner()
  const params = await searchParams
  const db = getDb()
  const options = formOptions(db)

  // A share from WhatsApp arrives with its uploads already stored under a batch id.
  const batch = first(params.batch)
  const shared = batch && /^[A-Za-z0-9-]{8,64}$/.test(batch) ? listBatch(db, batch) : []
  const rejected = Number(first(params.rejected) ?? 0)
  const sharedRaw = first(params.shared)
  const sharedId = sharedRaw && /^[0-9a-f-]{36}$/.test(sharedRaw) ? sharedRaw : undefined

  return (
    <div>
      <h1 className="mb-5 font-display text-3xl font-semibold">Add product</h1>
      {options.categories.length === 0 ? (
        <p className="rounded-md bg-accent-soft p-4 text-sm">Add a category in Settings before adding products.</p>
      ) : (
        <ProductForm
          productId={null}
          status={null}
          initialValues={emptyForm(options.categories[0].id)}
          initialMedia={shared}
          batchId={batch && shared.length ? batch : randomUUID()}
          submitToken={randomUUID()}
          rejected={Number.isInteger(rejected) && rejected > 0 ? rejected : 0}
          sharedId={sharedId}
          {...options}
        />
      )}
    </div>
  )
}

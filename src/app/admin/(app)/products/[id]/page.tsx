import { randomUUID } from 'node:crypto'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getDb } from '@/db/client'
import { requireOwner } from '@/lib/auth/guard'
import { isAutofillEnabled } from '@/lib/autofill/autofill'
import { getAdminProduct } from '@/lib/catalogue/admin'
import { productPath } from '@/lib/catalogue/codes'
import { fromAdminProduct } from '@/lib/catalogue/form'
import { ProductForm } from '@/components/admin/ProductForm'
import { formOptions } from '../options'

export const metadata: Metadata = { title: 'Edit product' }

type Props = { params: Promise<{ id: string }> }

const STATUS_LABEL = { draft: 'Draft', available: 'Available', sold: 'Sold' } as const

export default async function EditProductPage({ params }: Props) {
  await requireOwner()
  const { id } = await params
  const product = /^\d+$/.test(id) ? getAdminProduct(getDb(), Number(id)) : null
  if (!product) notFound()

  return (
    <div>
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate font-display text-3xl font-semibold">{product.name}</h1>
          <p className="mt-1 text-xs text-muted">
            {product.code} · {STATUS_LABEL[product.status]}
          </p>
        </div>
        {product.status !== 'draft' && (
          <Link href={productPath(product)} target="_blank" className="shrink-0 rounded-full border border-line px-3 py-1.5 text-sm">
            View
          </Link>
        )}
      </div>
      <ProductForm
        productId={product.id}
        status={product.status}
        initialValues={fromAdminProduct(product)}
        initialMedia={product.media}
        batchId={randomUUID()}
        submitToken={product.submitToken || randomUUID()}
        autofillEnabled={isAutofillEnabled()}
        {...formOptions(getDb())}
      />
    </div>
  )
}

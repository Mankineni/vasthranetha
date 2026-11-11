'use client'

import { startTransition, useActionState, useEffect, useRef, useState } from 'react'
import { saveProduct, type SaveState } from '@/app/admin/(app)/products/actions'
import { orderMediaIds, type FormValues, type ProductIntent, type ProductPayload } from '@/lib/catalogue/form'
import type { MediaItem, ProductStatus } from '@/lib/catalogue/types'
import { ChipInput } from './ChipInput'
import { MarginHint } from './MarginHint'
import { displayOrder, itemFromMedia, PhotoPicker, type PhotoItem } from './PhotoPicker'

type Option = { id: number; name: string }

type Props = {
  productId: number | null
  status: ProductStatus | null
  initialValues: FormValues
  initialMedia: MediaItem[]
  batchId: string
  submitToken: string
  categories: Option[]
  fabrics: Option[]
  occasions: Option[]
  /** Files a share could not use (unsupported type or too large). */
  rejected?: number
  /** A share kept on the phone by the service worker. */
  sharedId?: string
}

const STANDARD_SIZES = ['S', 'M', 'L', 'XL', 'XXL']

const inputClass = 'mt-1 block w-full rounded-md border border-line bg-surface px-3 py-2.5 text-base text-ink'

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-ink">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  )
}

function Toggle({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-sm ${on ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-surface text-ink'}`}
    >
      {label}
    </button>
  )
}

export function ProductForm(props: Props) {
  const { productId, status, categories, fabrics, occasions } = props
  const [values, setValues] = useState<FormValues>(props.initialValues)
  const [items, setItems] = useState<PhotoItem[]>(() => props.initialMedia.map((m) => itemFromMedia(m)))
  const [state, formAction, pending] = useActionState<SaveState, FormData>(saveProduct, { errors: [] })
  const [localError, setLocalError] = useState<string | null>(null)
  const submitting = useRef(false)
  const errorBox = useRef<HTMLDivElement>(null)

  // The action returned (with errors): allow another submit and show the errors.
  useEffect(() => {
    submitting.current = false
    if (state.errors.length) errorBox.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [state])

  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) => setValues((v) => ({ ...v, [key]: value }))
  const toggleIn = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter((x) => x !== value) : [...list, value])

  const busyUploading = items.some((i) => i.status === 'queued' || i.status === 'uploading')
  const customSizes = values.sizes.filter((s) => !STANDARD_SIZES.includes(s))

  function submit(intent: ProductIntent) {
    if (submitting.current || pending) return
    if (busyUploading) {
      setLocalError('Please wait until the photos finish uploading.')
      return
    }
    setLocalError(null)
    submitting.current = true
    const done = displayOrder(items).flatMap((i) => (i.status === 'done' && i.media ? [{ id: i.media.id, kind: i.media.kind }] : []))
    const payload: ProductPayload = {
      id: productId,
      intent,
      submitToken: props.submitToken,
      mediaIds: orderMediaIds(done),
      values,
    }
    const fd = new FormData()
    fd.set('payload', JSON.stringify(payload))
    startTransition(() => formAction(fd))
  }

  const errors = [...(localError ? [localError] : []), ...state.errors]
  const isNew = productId === null
  const isDraft = isNew || status === 'draft'
  const disabled = pending || busyUploading

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        submit(isDraft ? 'publish' : 'save')
      }}
      className="space-y-8"
    >
      {props.rejected ? (
        <p className="rounded-md bg-accent-soft px-3 py-2 text-sm text-ink">
          {props.rejected} file{props.rejected === 1 ? '' : 's'} could not be used (unsupported type or too large).
        </p>
      ) : null}

      <div ref={errorBox}>
        {errors.length > 0 && (
          <div role="alert" data-testid="form-errors" className="rounded-md border border-danger/40 bg-accent-soft px-3 py-2 text-sm text-danger">
            {errors.map((e) => (
              <p key={e}>{e}</p>
            ))}
          </div>
        )}
      </div>

      <section>
        <h2 className="mb-2 font-display text-xl font-semibold">Photos</h2>
        <PhotoPicker items={items} onChange={setItems} batchId={props.batchId} sharedId={props.sharedId} />
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-xl font-semibold">Details</h2>
        <Field label="Name">
          <input data-testid="name" value={values.name} onChange={(e) => set('name', e.target.value)} className={inputClass} maxLength={120} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Selling price (₹)">
            <input
              data-testid="price"
              inputMode="numeric"
              value={values.price}
              onChange={(e) => set('price', e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Category">
            <select data-testid="category" value={values.categoryId} onChange={(e) => set('categoryId', e.target.value)} className={inputClass}>
              {!values.categoryId && <option value="">Choose…</option>}
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Fabric">
          <select value={values.fabricId} onChange={(e) => set('fabricId', e.target.value)} className={inputClass}>
            <option value="">Not specified</option>
            {fabrics.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </Field>
        {occasions.length > 0 && (
          <div>
            <span className="text-sm font-medium text-ink">Occasions</span>
            <div className="mt-1 flex flex-wrap gap-2">
              {occasions.map((o) => (
                <Toggle key={o.id} label={o.name} on={values.occasionIds.includes(o.id)} onClick={() => set('occasionIds', toggleIn(values.occasionIds, o.id))} />
              ))}
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Length">
            <input value={values.length} onChange={(e) => set('length', e.target.value)} placeholder="e.g. 6.3 m" className={inputClass} />
          </Field>
          <Field label="Blouse piece">
            <select value={values.blousePiece} onChange={(e) => set('blousePiece', e.target.value as FormValues['blousePiece'])} className={inputClass}>
              <option value="">Not specified</option>
              <option value="yes">Included</option>
              <option value="no">Not included</option>
            </select>
          </Field>
        </div>
        <Field label="Care">
          <input value={values.care} onChange={(e) => set('care', e.target.value)} placeholder="e.g. Dry clean only" className={inputClass} />
        </Field>
        <Field label="Description">
          <textarea value={values.description} onChange={(e) => set('description', e.target.value)} rows={4} className={inputClass} />
        </Field>
        <div>
          <span className="text-sm font-medium text-ink">Sizes</span>
          <span className="ml-2 text-xs text-muted">Leave empty for sarees</span>
          <div className="mt-1 flex flex-wrap gap-2">
            {STANDARD_SIZES.map((s) => (
              <Toggle key={s} label={s} on={values.sizes.includes(s)} onClick={() => set('sizes', toggleIn(values.sizes, s))} />
            ))}
          </div>
          <div className="mt-2">
            <ChipInput
              label="Other sizes"
              values={customSizes}
              onChange={(custom) => set('sizes', [...values.sizes.filter((s) => STANDARD_SIZES.includes(s)), ...custom])}
              placeholder="e.g. Free size"
            />
          </div>
        </div>
        <ChipInput label="Colours" values={values.colours} onChange={(c) => set('colours', c)} placeholder="e.g. Teal, then Enter" />
      </section>

      <section className="space-y-4 rounded-lg border border-line bg-surface p-4">
        <h2 className="font-display text-xl font-semibold">Private (only you see this)</h2>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Dealer name">
            <input value={values.dealerName} onChange={(e) => set('dealerName', e.target.value)} className={inputClass} />
          </Field>
          <Field label="Dealer's code">
            <input value={values.dealerCode} onChange={(e) => set('dealerCode', e.target.value)} className={inputClass} />
          </Field>
        </div>
        <Field label="Dealer price (₹)">
          <input
            data-testid="dealer-price"
            inputMode="numeric"
            value={values.dealerPrice}
            onChange={(e) => set('dealerPrice', e.target.value)}
            className={inputClass}
          />
        </Field>
        <MarginHint price={values.price} dealerPrice={values.dealerPrice} />
        <Field label="Notes">
          <textarea value={values.notes} onChange={(e) => set('notes', e.target.value)} rows={2} className={inputClass} />
        </Field>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 px-4 pt-3 backdrop-blur" style={{ paddingBottom: 'calc(12px + env(safe-area-inset-bottom))' }}>
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          {busyUploading && <span className="flex-1 text-xs text-muted">Uploading photos…</span>}
          {isDraft ? (
            <>
              <button
                type="button"
                data-testid="save-draft"
                disabled={disabled}
                onClick={() => submit('draft')}
                className="flex-1 rounded-full border border-line px-4 py-3 text-sm font-medium text-ink disabled:opacity-50"
              >
                {isNew ? 'Save as draft' : 'Save draft'}
              </button>
              <button
                type="button"
                data-testid="publish"
                disabled={disabled}
                onClick={() => submit('publish')}
                className="flex-1 rounded-full bg-accent px-4 py-3 text-sm font-medium text-accent-ink disabled:opacity-50"
              >
                {pending ? 'Saving…' : 'Publish'}
              </button>
            </>
          ) : (
            <button
              type="button"
              data-testid="save"
              disabled={disabled}
              onClick={() => submit('save')}
              className="flex-1 rounded-full bg-accent px-4 py-3 text-sm font-medium text-accent-ink disabled:opacity-50"
            >
              {pending ? 'Saving…' : 'Save changes'}
            </button>
          )}
        </div>
      </div>
    </form>
  )
}

'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { clearSiteImage, removeCustomerPhoto } from '@/app/admin/(app)/settings/actions'
import { mediaUrl } from '@/lib/media/urls'
import { failed, safely } from '../safeAction'
import { ErrorText, uploadSiteImage } from './ui'

const ACCEPT = 'image/jpeg,image/png,image/webp'

/** Logo or banner: one image, replace or remove. */
export function ImageField({ target, label, hint, current }: { target: 'logo' | 'banner'; label: string; hint: string; current: string | null }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  async function upload(file: File | undefined) {
    if (!file) return
    setBusy(true)
    setError(await uploadSiteImage(file, target))
    setBusy(false)
    router.refresh()
  }

  return (
    <div>
      <p className="text-sm font-medium">{label}</p>
      <p className="text-xs text-muted">{hint}</p>
      <div className="mt-2 flex items-center gap-3">
        {current && (
          // eslint-disable-next-line @next/next/no-img-element -- stored site image
          <img data-testid={`${target}-preview`} src={mediaUrl(current)} alt="" className={target === 'logo' ? 'h-14 w-14 rounded-full object-cover' : 'h-20 w-36 rounded object-cover'} />
        )}
        <label className="cursor-pointer rounded-full border border-line px-4 py-2 text-sm">
          {busy ? 'Uploading…' : current ? 'Replace' : 'Upload'}
          <input data-testid={`${target}-input`} type="file" accept={ACCEPT} className="sr-only" disabled={busy} onChange={(e) => upload(e.target.files?.[0])} />
        </label>
        {current && (
          <button
            type="button"
            className="text-sm text-danger"
            onClick={() =>
              startTransition(async () => {
                const r = await safely(() => clearSiteImage(target))
                setError(failed(r) ? r.error : null)
                router.refresh()
              })
            }
          >
            Remove
          </button>
        )}
      </div>
      <ErrorText error={error} />
    </div>
  )
}

/** Customer photos shown on the home page (up to 12). */
export function CustomerPhotos({ photos }: { photos: string[] }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  async function upload(files: FileList | null) {
    if (!files?.length) return
    setBusy(true)
    setError(null)
    for (const file of Array.from(files)) {
      const err = await uploadSiteImage(file, 'customer')
      if (err) setError(err)
    }
    setBusy(false)
    router.refresh()
  }

  return (
    <div>
      <p className="text-sm font-medium">Customer photos</p>
      <p className="text-xs text-muted">Photos customers sent you, shown on the home page. Up to 12; ask before using them.</p>
      <div className="mt-2 grid grid-cols-4 gap-2">
        {photos.map((p) => (
          <div key={p} data-testid="customer-photo" className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element -- stored site image */}
            <img src={mediaUrl(p)} alt="" className="aspect-square w-full rounded object-cover" />
            <button
              type="button"
              aria-label="Remove photo"
              className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white"
              onClick={() =>
                startTransition(async () => {
                  const r = await safely(() => removeCustomerPhoto(p))
                  setError(failed(r) ? r.error : null)
                  router.refresh()
                })
              }
            >
              ×
            </button>
          </div>
        ))}
        {photos.length < 12 && (
          <label className="flex aspect-square cursor-pointer items-center justify-center rounded border-2 border-dashed border-line text-xs text-muted">
            {busy ? 'Uploading…' : '+ Add'}
            <input data-testid="customer-input" type="file" multiple accept={ACCEPT} className="sr-only" disabled={busy} onChange={(e) => upload(e.target.files)} />
          </label>
        )}
      </div>
      <ErrorText error={error} />
    </div>
  )
}

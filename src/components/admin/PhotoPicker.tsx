'use client'

import { useEffect, useRef, useState } from 'react'
import { MAX_PHOTOS, MAX_VIDEOS, type MediaItem } from '@/lib/catalogue/types'
import { precheckUpload } from '@/lib/media/limits'
import { variantAtLeast } from '@/lib/media/urls'
import { readSharedFiles } from './sharedFiles'

export type PhotoItem = {
  key: string
  kind: 'photo' | 'video'
  status: 'queued' | 'uploading' | 'done' | 'failed'
  file?: File
  /** Object URL of a local file, or a stored variant URL. */
  preview?: string
  media?: MediaItem
  lowRes?: boolean
  error?: string
  /** File name, shown when an upload fails. */
  name?: string
  /** False when the server refused the file itself (type or size): retrying cannot help. */
  retryable?: boolean
}

const PREVIEWABLE = ['image/jpeg', 'image/png', 'image/webp']

type Props = {
  items: PhotoItem[]
  onChange: (update: (items: PhotoItem[]) => PhotoItem[]) => void
  batchId: string
  /** Id of a share the service worker kept on the phone; its files are added on open. */
  sharedId?: string
}

let keySeq = 0
const newKey = () => `item-${Date.now().toString(36)}-${keySeq++}`

export function itemFromMedia(m: MediaItem, lowRes = false): PhotoItem {
  const thumb = m.kind === 'photo' ? variantAtLeast(m, 480) : null
  return { key: `media-${m.id}`, kind: m.kind, status: 'done', media: m, lowRes, preview: thumb ?? undefined }
}

/** Photos first in their order, then videos: the order the product page shows them. */
export function displayOrder(items: PhotoItem[]): PhotoItem[] {
  return [...items.filter((i) => i.kind === 'photo'), ...items.filter((i) => i.kind === 'video')]
}

async function uploadFile(file: File, batchId: string, signal: AbortSignal): Promise<Partial<PhotoItem>> {
  const body = new FormData()
  body.set('file', file)
  body.set('batchId', batchId)
  try {
    const res = await fetch('/admin/upload', { method: 'POST', body, signal })
    const data = await res.json().catch(() => ({}))
    if (res.status === 401) return { status: 'failed', retryable: true, error: 'Please sign in again, then retry.' }
    if (res.status === 400 || res.status === 413) {
      return { status: 'failed', retryable: false, error: data.error ?? 'This file cannot be used.' }
    }
    if (!res.ok) return { status: 'failed', retryable: true, error: 'Upload failed. Tap Retry.' }
    return { status: 'done', media: data.media, kind: data.media.kind, lowRes: Boolean(data.lowRes), error: undefined }
  } catch {
    return { status: 'failed', retryable: true, error: 'Upload failed. Check your connection and tap Retry.' }
  }
}

export function PhotoPicker({ items, onChange, batchId, sharedId }: Props) {
  const input = useRef<HTMLInputElement>(null)
  const queue = useRef<Promise<void>>(Promise.resolve())
  // One per waiting or running upload, so removing a tile stops its upload.
  const controllers = useRef(new Map<string, AbortController>())
  const [notice, setNotice] = useState<string | null>(null)
  const shown = displayOrder(items)

  const update = (key: string, patch: Partial<PhotoItem>) =>
    onChange((list) => list.map((i) => (i.key === key ? { ...i, ...patch } : i)))

  // One upload at a time: gentle on phone data and on the server.
  function enqueue(item: PhotoItem) {
    const controller = new AbortController()
    controllers.current.set(item.key, controller)
    queue.current = queue.current.then(async () => {
      if (controller.signal.aborted) return // removed while waiting its turn
      update(item.key, { status: 'uploading' })
      const result = await uploadFile(item.file!, batchId, controller.signal)
      controllers.current.delete(item.key)
      if (!controller.signal.aborted) update(item.key, result)
    })
  }

  function add(files: FileList | File[] | null) {
    if (!files?.length) return
    const live = items.filter((i) => i.status !== 'failed')
    let photos = live.filter((i) => i.kind === 'photo').length
    let videos = live.filter((i) => i.kind === 'video').length
    const added: PhotoItem[] = []
    let skipped = 0
    for (const file of Array.from(files)) {
      const kind = file.type.startsWith('video/') ? 'video' : 'photo'
      // Refuse wrong types and oversized files here, before sending a byte over mobile data.
      const refused = precheckUpload(file)
      if (refused) {
        added.push({ key: newKey(), kind, status: 'failed', name: file.name, error: refused, retryable: false })
        continue
      }
      if ((kind === 'photo' && photos >= MAX_PHOTOS) || (kind === 'video' && videos >= MAX_VIDEOS)) {
        skipped++
        continue
      }
      if (kind === 'photo') photos++
      else videos++
      added.push({
        key: newKey(),
        kind,
        status: 'queued',
        file,
        name: file.name,
        preview: PREVIEWABLE.includes(file.type) ? URL.createObjectURL(file) : undefined,
      })
    }
    setNotice(skipped ? `Up to ${MAX_PHOTOS} photos and one video per product. ${skipped} file(s) were skipped.` : null)
    onChange((list) => [...list, ...added])
    added.filter((i) => i.status === 'queued').forEach(enqueue)
    if (input.current) input.current.value = ''
  }

  function remove(item: PhotoItem) {
    controllers.current.get(item.key)?.abort()
    controllers.current.delete(item.key)
    if (item.file && item.preview) URL.revokeObjectURL(item.preview)
    onChange((list) => list.filter((i) => i.key !== item.key))
  }

  function retry(item: PhotoItem) {
    update(item.key, { status: 'queued', error: undefined })
    enqueue(item)
  }

  /** Moves a photo within the photo order; delta -Infinity makes it the cover. */
  function move(item: PhotoItem, delta: number) {
    onChange((list) => {
      const photos = list.filter((i) => i.kind === 'photo')
      const rest = list.filter((i) => i.kind !== 'photo')
      const from = photos.findIndex((i) => i.key === item.key)
      const to = Math.max(0, Math.min(photos.length - 1, from + delta))
      if (from < 0 || from === to) return list
      photos.splice(to, 0, ...photos.splice(from, 1))
      return [...photos, ...rest]
    })
  }

  // Photos shared from WhatsApp and kept on the phone by the service worker.
  useEffect(() => {
    if (!sharedId) return
    let cancelled = false
    readSharedFiles(sharedId).then(({ files, discard }) => {
      if (cancelled) return
      if (files.length) add(files)
      else setNotice('The shared photos were not found on this phone. Please share them again.')
      void discard()
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once for the share that opened the form
  }, [sharedId])

  const photoCount = shown.filter((i) => i.kind === 'photo').length
  const anyLowRes = shown.some((i) => i.lowRes)

  return (
    <section>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {shown.map((item, index) => {
          const photoIndex = item.kind === 'photo' ? shown.filter((i) => i.kind === 'photo').indexOf(item) : -1
          return (
            <div
              key={item.key}
              data-testid={`photo-${index}`}
              data-status={item.status}
              className={`relative overflow-hidden rounded-md border ${item.status === 'failed' ? 'border-danger' : 'border-line'} bg-surface`}
            >
              <div className="relative aspect-[3/4] bg-accent-soft">
                {item.kind === 'video' && item.status !== 'failed' ? (
                  <div className="flex h-full items-center justify-center text-sm text-muted">▶ Video</div>
                ) : item.preview && item.status !== 'failed' ? (
                  // eslint-disable-next-line @next/next/no-img-element -- local preview or stored thumbnail
                  <img
                    src={item.preview}
                    alt=""
                    data-media-path={item.media?.originalPath}
                    className={`h-full w-full object-cover ${item.status === 'done' ? '' : 'opacity-50'}`}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center p-2 text-center text-xs text-muted">
                    <span className="break-all">{item.name ?? 'File'}</span>
                  </div>
                )}
                {photoIndex === 0 && item.status !== 'failed' && (
                  <span className="absolute left-1 top-1 rounded bg-accent px-1.5 py-0.5 text-[10px] font-medium text-accent-ink">
                    Cover
                  </span>
                )}
                {item.lowRes && (
                  <span
                    data-testid="lowres-warning"
                    className="absolute bottom-1 left-1 right-1 rounded bg-gold px-1 py-0.5 text-center text-[10px] font-medium text-white"
                  >
                    May look soft
                  </span>
                )}
                {(item.status === 'queued' || item.status === 'uploading') && (
                  <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-ink">
                    {item.status === 'queued' ? 'Waiting…' : 'Uploading…'}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => remove(item)}
                  aria-label="Remove"
                  className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white"
                >
                  ×
                </button>
              </div>
              {item.status === 'failed' ? (
                <div className="p-1.5">
                  <p className="text-[11px] leading-tight text-danger">{item.error}</p>
                  {item.retryable && item.file && (
                    <button type="button" onClick={() => retry(item)} className="mt-1 text-xs font-medium text-accent">
                      Retry
                    </button>
                  )}
                </div>
              ) : item.kind === 'photo' && item.status === 'done' && photoCount > 1 ? (
                <div className="flex items-center justify-between gap-1 p-1">
                  <button type="button" aria-label="Move left" onClick={() => move(item, -1)} className="h-7 w-7 rounded text-ink hover:bg-accent-soft">
                    ‹
                  </button>
                  {photoIndex > 0 && (
                    <button type="button" onClick={() => move(item, -Infinity)} className="text-[11px] font-medium text-accent">
                      Make cover
                    </button>
                  )}
                  <button type="button" aria-label="Move right" onClick={() => move(item, 1)} className="h-7 w-7 rounded text-ink hover:bg-accent-soft">
                    ›
                  </button>
                </div>
              ) : null}
            </div>
          )
        })}
        <label className="flex aspect-[3/4] cursor-pointer flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-line text-center text-sm text-muted hover:border-accent">
          <span className="text-2xl leading-none">+</span>
          <span>Add photos</span>
          <input
            ref={input}
            data-testid="photo-input"
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,video/mp4"
            className="sr-only"
            onChange={(e) => add(e.target.files)}
          />
        </label>
      </div>
      {notice && <p className="mt-2 text-xs text-danger">{notice}</p>}
      {anyLowRes && (
        <p className="mt-2 text-xs text-muted">
          Photos marked “May look soft” are under 1,200 pixels. Ask the dealer to send them with WhatsApp’s HD option, or as a
          document.
        </p>
      )}
    </section>
  )
}

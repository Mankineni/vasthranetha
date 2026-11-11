'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import {
  addCategory,
  moveCategory,
  removeCategory,
  removeCategoryTile,
  saveCategory,
  type ActionResult,
} from '@/app/admin/(app)/settings/actions'
import { mediaUrl } from '@/lib/media/urls'
import { failed, safely, useSafeForm } from '../safeAction'
import { ErrorText, inputClass, Saved, uploadSiteImage } from './ui'

type Category = { id: number; name: string; codePrefix: string; tileImage: string | null }

const start: ActionResult = { ok: false, error: null, version: 0 }
const cellInput = 'block w-full rounded-md border border-line bg-surface px-3 py-2 text-base text-ink'

function CategoryRow({ c, first, last, onError }: { c: Category; first: boolean; last: boolean; onError: (e: string | null) => void }) {
  const router = useRouter()
  const { state, onSubmit, pending } = useSafeForm(saveCategory.bind(null, c.id), start)
  const [busy, startTransition] = useTransition()
  const [uploading, setUploading] = useState(false)

  async function uploadTile(file: File | undefined) {
    if (!file) return
    setUploading(true)
    onError(await uploadSiteImage(file, 'tile', c.id))
    setUploading(false)
    router.refresh()
  }

  /** Runs a row button's action; a lost connection becomes a message above the list. */
  const run = (action: () => Promise<unknown>) =>
    startTransition(async () => {
      const result = await safely(action)
      if (failed(result)) onError(result.error)
      else if (result && typeof result === 'object' && 'error' in result) onError((result as { error: string | null }).error)
      else onError(null)
    })

  return (
    <li data-testid="category-row" className="space-y-2 px-3 py-3">
      <p className="text-sm">
        <span className="font-medium text-ink">{c.name}</span>
        <span className="text-muted"> · codes start with {c.codePrefix}-</span>
      </p>
      <form key={state.version} onSubmit={onSubmit} className="grid grid-cols-[1fr_4rem_auto] items-center gap-2">
        <input name="name" defaultValue={c.name} aria-label={`Rename ${c.name}`} className={`${cellInput} min-w-0`} />
        <input name="codePrefix" defaultValue={c.codePrefix} aria-label={`Prefix for ${c.name}`} maxLength={3} className={`${cellInput} uppercase`} />
        <button type="submit" disabled={pending} className="rounded-full border border-line px-3 py-2 text-sm">
          Save
        </button>
      </form>
      <ErrorText error={state.error} />
      <Saved show={state.ok && !pending} />
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {c.tileImage && (
          // eslint-disable-next-line @next/next/no-img-element -- stored tile image
          <img src={mediaUrl(c.tileImage)} alt="" className="h-10 w-8 rounded object-cover" />
        )}
        <label className="cursor-pointer rounded-full border border-line px-3 py-1.5">
          {uploading ? 'Uploading…' : c.tileImage ? 'Change tile photo' : 'Tile photo'}
          <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => uploadTile(e.target.files?.[0])} />
        </label>
        {c.tileImage && (
          <button type="button" className="text-muted" onClick={() => run(async () => { await removeCategoryTile(c.id); router.refresh() })}>
            Use newest product
          </button>
        )}
        <span className="flex-1" />
        <button type="button" aria-label={`Move ${c.name} up`} disabled={first || busy} onClick={() => run(() => moveCategory(c.id, -1))} className="h-8 w-8 rounded-full border border-line disabled:opacity-30">
          ↑
        </button>
        <button type="button" aria-label={`Move ${c.name} down`} disabled={last || busy} onClick={() => run(() => moveCategory(c.id, 1))} className="h-8 w-8 rounded-full border border-line disabled:opacity-30">
          ↓
        </button>
        <button
          type="button"
          disabled={busy}
          className="rounded-full px-3 py-1.5 text-danger"
          onClick={() => {
            if (!window.confirm(`Delete the category ${c.name}?`)) return
            run(() => removeCategory(c.id))
          }}
        >
          Delete
        </button>
      </div>
    </li>
  )
}

export function CategoryEditor({ categories }: { categories: Category[] }) {
  const { state, onSubmit, pending } = useSafeForm(addCategory, start)
  const [rowError, setRowError] = useState<string | null>(null)

  return (
    <section>
      <h2 className="mb-1 font-display text-2xl font-semibold">Categories</h2>
      <p className="mb-3 text-xs text-muted">
        The code letters start each product code (S for S-1042). The tile photo shows on the home page; without one, the newest
        product is used. Renaming keeps the category&apos;s web address, so shared links keep working.
      </p>
      <ErrorText error={rowError} />
      <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
        {categories.map((c, i) => (
          <CategoryRow key={`${c.id}-${c.name}-${c.codePrefix}`} c={c} first={i === 0} last={i === categories.length - 1} onError={setRowError} />
        ))}
      </ul>
      <form key={state.version} onSubmit={onSubmit} className="mt-3 grid grid-cols-[1fr_6rem] items-end gap-2">
        <label className="min-w-0">
          <span className="text-sm">New category name</span>
          <input name="name" required className={inputClass} placeholder="e.g. Kurtis" />
        </label>
        <label>
          <span className="text-sm">Code letters</span>
          <input name="codePrefix" required maxLength={3} className={`${inputClass} uppercase`} placeholder="K" />
        </label>
        <button type="submit" disabled={pending} className="col-span-2 rounded-full bg-accent px-4 py-2.5 text-sm font-medium text-accent-ink">
          Add category
        </button>
      </form>
      <ErrorText error={state.error} />
    </section>
  )
}

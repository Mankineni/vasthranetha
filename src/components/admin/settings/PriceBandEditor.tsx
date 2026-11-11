'use client'

import { useState, useTransition } from 'react'
import { saveBands, type SavedBand } from '@/app/admin/(app)/settings/actions'
import { failed, safely } from '../safeAction'
import { ErrorText, inputClass, Saved } from './ui'

/** `id` is set for stored bands so saving keeps their /price/<id> addresses. */
type Band = { key: number; id?: number; label: string; min: string; max: string }

let nextKey = -1

const toBand = (b: SavedBand): Band => ({ key: b.id, id: b.id, label: b.label, min: String(b.min), max: b.max === null ? '' : String(b.max) })

export function PriceBandEditor({ initial }: { initial: SavedBand[] }) {
  const [bands, setBands] = useState<Band[]>(() => initial.map(toBand))
  const [result, setResult] = useState<{ ok: boolean; error: string | null } | null>(null)
  const [pending, startTransition] = useTransition()

  const update = (key: number, patch: Partial<Band>) => {
    setResult(null)
    setBands((list) => list.map((b) => (b.key === key ? { ...b, ...patch } : b)))
  }

  function save() {
    startTransition(async () => {
      const r = await safely(() => saveBands(bands.map(({ id, label, min, max }) => ({ id, label, min, max }))))
      if (failed(r)) {
        setResult({ ok: false, error: r.error })
        return
      }
      // Adopt the stored bands, so a band added on this visit keeps its new id on the next save.
      if (r.ok && r.bands) setBands(r.bands.map(toBand))
      setResult({ ok: r.ok, error: r.error })
    })
  }

  return (
    <div>
      <ul className="space-y-3">
        {bands.map((b) => (
          <li key={b.key} data-testid="band-row" className="rounded-lg border border-line bg-surface p-3">
            <div className="grid grid-cols-6 gap-2">
              <label className="col-span-6">
                <span className="text-xs text-muted">Label</span>
                <input value={b.label} onChange={(e) => update(b.key, { label: e.target.value })} className={inputClass} />
              </label>
              <label className="col-span-3">
                <span className="text-xs text-muted">From (₹)</span>
                <input inputMode="numeric" value={b.min} onChange={(e) => update(b.key, { min: e.target.value })} className={inputClass} />
              </label>
              <label className="col-span-3">
                <span className="text-xs text-muted">Up to (₹)</span>
                <input inputMode="numeric" value={b.max} placeholder="No limit" onChange={(e) => update(b.key, { max: e.target.value })} className={inputClass} />
              </label>
            </div>
            <button type="button" className="mt-2 text-sm text-danger" onClick={() => setBands((list) => list.filter((x) => x.key !== b.key))}>
              Remove band
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="rounded-full border border-line px-4 py-2 text-sm"
          onClick={() => setBands((list) => [...list, { key: nextKey--, label: '', min: '', max: '' }])}
        >
          Add band
        </button>
        <button
          type="button"
          disabled={pending}
          className="rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-accent-ink disabled:opacity-60"
          onClick={save}
        >
          {pending ? 'Saving…' : 'Save price bands'}
        </button>
      </div>
      <div className="mt-2">
        <ErrorText error={result?.error} />
        <Saved show={Boolean(result?.ok)} />
      </div>
    </div>
  )
}

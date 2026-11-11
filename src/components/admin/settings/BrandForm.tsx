'use client'

import { saveBrand, type BrandState } from '@/app/admin/(app)/settings/actions'
import { useSafeForm } from '../safeAction'
import { ErrorText, inputClass, Saved } from './ui'

export function BrandForm({ initial }: { initial: BrandState['values'] }) {
  const { state, onSubmit, pending } = useSafeForm<BrandState>(saveBrand, {
    ok: false,
    error: null,
    version: 0,
    values: initial,
  })
  const v = state.values

  return (
    // Remount after each successful save so the fields show the stored (normalised) values.
    <form key={state.version} onSubmit={onSubmit} className="space-y-4">
      <label className="block">
        <span className="text-sm font-medium">Brand name</span>
        <input name="brandName" defaultValue={v.brandName} required maxLength={80} className={inputClass} />
      </label>
      <label className="block">
        <span className="text-sm font-medium">Tagline</span>
        <input name="tagline" defaultValue={v.tagline} maxLength={160} className={inputClass} />
      </label>
      <label className="block">
        <span className="text-sm font-medium">WhatsApp business number</span>
        <input
          name="whatsappNumber"
          type="tel"
          inputMode="tel"
          defaultValue={v.whatsappNumber}
          placeholder="e.g. 98765 43210"
          className={inputClass}
        />
        <span className="mt-1 block text-xs text-muted">Leave empty to hide the order buttons until the number is ready.</span>
      </label>
      <label className="block">
        <span className="text-sm font-medium">Days a sold product stays in listings</span>
        <input name="soldVisibleDays" inputMode="numeric" defaultValue={v.soldVisibleDays} className={`${inputClass} max-w-24`} />
        <span className="mt-1 block text-xs text-muted">0 hides sold products from listings straight away. Their pages keep working.</span>
      </label>
      <ErrorText error={state.error} />
      <Saved show={state.ok && !pending} />
      <button type="submit" disabled={pending} className="rounded-full bg-accent px-6 py-2.5 text-sm font-medium text-accent-ink disabled:opacity-60">
        {pending ? 'Saving…' : 'Save'}
      </button>
    </form>
  )
}

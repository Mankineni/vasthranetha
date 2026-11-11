'use client'

import { useActionState } from 'react'
import { savePageText, type ActionResult } from '@/app/admin/(app)/settings/actions'
import { ErrorText, inputClass, Saved } from './ui'

type Props = { slug: string; heading: string; title: string; body: string }

const start: ActionResult = { ok: false, error: null, version: 0 }

export function PageTextForm({ slug, heading, title, body }: Props) {
  const [state, action, pending] = useActionState(savePageText.bind(null, slug), start)
  return (
    <form data-testid={`page-${slug}`} action={action} className="space-y-3 rounded-lg border border-line bg-surface p-4">
      <h2 className="font-display text-xl font-semibold">{heading}</h2>
      <label className="block">
        <span className="text-sm">Title</span>
        <input name="title" defaultValue={title} required className={inputClass} />
      </label>
      <label className="block">
        <span className="text-sm">Text</span>
        <textarea name="body" defaultValue={body} rows={6} className={inputClass} />
        <span className="mt-1 block text-xs text-muted">Leave an empty line between paragraphs.</span>
      </label>
      <ErrorText error={state.error} />
      <Saved show={state.ok && !pending} />
      <button type="submit" disabled={pending} className="rounded-full bg-accent px-5 py-2 text-sm font-medium text-accent-ink disabled:opacity-60">
        {pending ? 'Saving…' : 'Save'}
      </button>
    </form>
  )
}

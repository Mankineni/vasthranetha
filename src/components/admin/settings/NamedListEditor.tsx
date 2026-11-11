'use client'

import { useActionState, useState, useTransition } from 'react'
import { addListItem, removeListItem, type ActionResult } from '@/app/admin/(app)/settings/actions'
import { ErrorText, inputClass } from './ui'

type Props = { kind: 'fabric' | 'occasion'; title: string; items: { id: number; name: string }[]; placeholder: string }

const start: ActionResult = { ok: false, error: null, version: 0 }

/** Fabrics or occasions: add and delete names used by the product form and the filters. */
export function NamedListEditor({ kind, title, items, placeholder }: Props) {
  const [state, action, pending] = useActionState(addListItem.bind(null, kind), start)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [busy, startTransition] = useTransition()

  return (
    <section>
      <h2 className="mb-3 font-display text-2xl font-semibold">{title}</h2>
      <ul className="flex flex-wrap gap-2">
        {items.map((item) => (
          <li key={item.id} data-testid={`${kind}-row`} className="inline-flex items-center gap-1 rounded-full border border-line bg-surface py-1 pl-3 pr-1 text-sm">
            {item.name}
            <button
              type="button"
              aria-label={`Delete ${item.name}`}
              disabled={busy}
              className="flex h-6 w-6 items-center justify-center rounded-full text-muted hover:bg-accent-soft"
              onClick={() => {
                if (!window.confirm(`Delete ${item.name}?`)) return
                startTransition(async () => setDeleteError((await removeListItem(kind, item.id)).error))
              }}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      <ErrorText error={deleteError} />
      <form key={state.version} action={action} className="mt-3 flex items-end gap-2">
        <label className="min-w-0 flex-1">
          <span className="text-sm">New {kind}</span>
          <input name="name" required placeholder={placeholder} className={inputClass} />
        </label>
        <button type="submit" disabled={pending} className="rounded-full bg-accent px-4 py-2.5 text-sm font-medium text-accent-ink">
          Add {kind}
        </button>
      </form>
      <ErrorText error={state.error} />
    </section>
  )
}

'use client'

import { useState } from 'react'

type Props = { label: string; values: string[]; onChange: (values: string[]) => void; placeholder?: string; testId?: string }

/** Type a value and press Enter or comma to add it. */
export function ChipInput({ label, values, onChange, placeholder, testId }: Props) {
  const [text, setText] = useState('')

  function commit(raw: string) {
    const parts = raw.split(',').map((s) => s.trim()).filter(Boolean)
    const next = [...values]
    for (const p of parts) if (!next.some((v) => v.toLowerCase() === p.toLowerCase())) next.push(p)
    if (next.length !== values.length) onChange(next)
    setText('')
  }

  return (
    <div>
      <span className="text-sm font-medium text-ink">{label}</span>
      <div className="mt-1 flex flex-wrap items-center gap-1.5 rounded-md border border-line bg-surface p-2">
        {values.map((v) => (
          <span key={v} className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-1 text-sm text-ink">
            {v}
            <button type="button" aria-label={`Remove ${v}`} onClick={() => onChange(values.filter((x) => x !== v))} className="text-muted">
              ×
            </button>
          </span>
        ))}
        <input
          aria-label={label}
          data-testid={testId}
          value={text}
          placeholder={values.length ? '' : placeholder}
          onChange={(e) => (e.target.value.includes(',') ? commit(e.target.value) : setText(e.target.value))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              commit(text)
            } else if (e.key === 'Backspace' && !text && values.length) {
              onChange(values.slice(0, -1))
            }
          }}
          onBlur={() => text && commit(text)}
          className="min-w-24 flex-1 bg-transparent px-1 py-1 text-base outline-none"
        />
      </div>
    </div>
  )
}

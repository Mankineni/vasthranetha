'use client'

import { useState } from 'react'

/** Opens the phone's share menu; falls back to copying the link. */
export function ShareButton({ title, url, label = 'Share' }: { title: string; url: string; label?: string }) {
  const [copied, setCopied] = useState(false)

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title, url })
        return
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt('Copy this link', url)
    }
  }

  return (
    <button
      type="button"
      onClick={share}
      className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-sm text-ink"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v13" />
      </svg>
      {copied ? 'Link copied' : label}
    </button>
  )
}

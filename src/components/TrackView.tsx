'use client'

import { useEffect, useRef } from 'react'
import { sendEvent } from '@/lib/stats/beacon'

/** Counts one view of a product page per visit (works on cached pages too). */
export function TrackView({ code }: { code: string }) {
  const sent = useRef<string | null>(null)
  useEffect(() => {
    if (sent.current === code) return
    sent.current = code
    sendEvent(code, 'view')
  }, [code])
  return null
}

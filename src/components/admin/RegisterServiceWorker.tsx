'use client'

import { useEffect } from 'react'

/** Registers the admin service worker (installable app + share target). */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/admin/sw.js', { scope: '/admin' }).catch(() => {
      // Not fatal: the site works without it, and shares fall back to the server route.
    })
  }, [])
  return null
}

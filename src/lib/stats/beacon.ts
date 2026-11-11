// Browser side: report a product view or order tap. Fire-and-forget, never throws.
export function sendEvent(code: string, type: 'view' | 'order_tap'): void {
  try {
    const body = new Blob([JSON.stringify({ code, type })], { type: 'application/json' })
    if (navigator.sendBeacon?.('/api/event', body)) return
    void fetch('/api/event', { method: 'POST', body, keepalive: true }).catch(() => {})
  } catch {
    // Counting must never get in the way of the customer.
  }
}

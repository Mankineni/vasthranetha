'use client' // Error boundaries must be Client Components

// Last resort when the root layout itself fails. It replaces the whole document and gets
// none of the site's styles, so it carries its own minimal inline styling.
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  console.error(error)
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#fbf7f2', color: '#2a1a1f' }}>
        <title>Something went wrong</title>
        <main style={{ maxWidth: 420, margin: '0 auto', padding: '96px 16px', textAlign: 'center' }}>
          <p style={{ fontSize: 28, fontWeight: 600, color: '#7a1f2b' }}>Something went wrong</p>
          <p style={{ color: '#76666b' }}>The site could not load just now. Please try again in a moment.</p>
          <button
            type="button"
            onClick={() => retry()}
            style={{ marginTop: 24, padding: '12px 24px', borderRadius: 999, border: 0, background: '#7a1f2b', color: '#fff', fontSize: 15 }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  )
}

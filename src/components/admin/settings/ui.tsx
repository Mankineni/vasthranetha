'use client'

// Small shared pieces for the settings screens.

export const inputClass = 'mt-1 block w-full rounded-md border border-line bg-surface px-3 py-2.5 text-base text-ink'

export function Saved({ show }: { show: boolean }) {
  return show ? (
    <p role="status" className="text-sm font-medium text-whatsapp">
      Saved.
    </p>
  ) : null
}

export function ErrorText({ error }: { error: string | null | undefined }) {
  return error ? (
    <p role="alert" className="text-sm text-danger">
      {error}
    </p>
  ) : null
}

export async function uploadSiteImage(
  file: File,
  target: 'logo' | 'banner' | 'customer' | 'tile',
  categoryId?: number,
): Promise<string | null> {
  const body = new FormData()
  body.set('file', file)
  body.set('target', target)
  if (categoryId !== undefined) body.set('categoryId', String(categoryId))
  try {
    const res = await fetch('/admin/site-image', { method: 'POST', body })
    if (res.ok) return null
    const data = await res.json().catch(() => ({}))
    return data.error ?? 'Upload failed. Please try again.'
  } catch {
    return 'Upload failed. Check your connection and try again.'
  }
}

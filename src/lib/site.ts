/** Public address of the site, without a trailing slash (from SITE_URL). */
export function siteUrl(): string {
  return (process.env.SITE_URL || 'http://localhost:3000').replace(/\/+$/, '')
}

export function absoluteUrl(path: string): string {
  return `${siteUrl()}${path.startsWith('/') ? '' : '/'}${path}`
}

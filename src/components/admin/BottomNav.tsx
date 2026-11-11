'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const ITEMS = [
  { href: '/admin', label: 'Home', icon: 'M3 11 12 4l9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z' },
  { href: '/admin/products', label: 'Products', icon: 'M4 6h16M4 12h16M4 18h16' },
  { href: '/admin/products/new', label: 'Add', icon: 'M12 5v14M5 12h14' },
  { href: '/admin/settings', label: 'Settings', icon: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8-3-2-1 1-2-2-2-2 1-1-2h-4l-1 2-2-1-2 2 1 2-2 1v4l2 1-1 2 2 2 2-1 1 2h4l1-2 2 1 2-2-1-2 2-1z' },
]

/** Hidden on the product form, which has its own Save/Publish bar at the bottom. */
export function BottomNav() {
  const path = usePathname()
  if (/^\/admin\/products\/(new|\d+)$/.test(path)) return null
  const active = (href: string) =>
    href === '/admin' ? path === '/admin' : href === '/admin/products' ? /^\/admin\/products($|\?)/.test(path) : path.startsWith(href)

  return (
    <nav
      aria-label="Admin"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="mx-auto flex max-w-3xl">
        {ITEMS.map((item) => (
          <li key={item.href} className="flex-1">
            <Link
              href={item.href}
              aria-current={active(item.href) ? 'page' : undefined}
              className={`flex flex-col items-center gap-0.5 py-2 text-[11px] ${active(item.href) ? 'text-accent' : 'text-muted'}`}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden>
                <path d={item.icon} />
              </svg>
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}

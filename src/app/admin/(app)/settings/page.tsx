import type { Metadata } from 'next'
import Link from 'next/link'
import { requireOwner } from '@/lib/auth/guard'

export const metadata: Metadata = { title: 'Settings' }

const SECTIONS = [
  { href: '/admin/settings/brand', title: 'Brand and WhatsApp', text: 'Name, tagline, logo, banner, WhatsApp number, customer photos' },
  { href: '/admin/settings/lists', title: 'Categories and lists', text: 'Categories, fabrics and occasions' },
  { href: '/admin/settings/bands', title: 'Price bands', text: 'The “Shop by price” choices' },
  { href: '/admin/settings/pages', title: 'Page texts', text: 'About us, How to order, Shipping and returns, Contact' },
]

export default async function SettingsPage() {
  await requireOwner()
  return (
    <div>
      <h1 className="mb-5 font-display text-3xl font-semibold">Settings</h1>
      <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
        {SECTIONS.map((s) => (
          <li key={s.href}>
            <Link href={s.href} className="flex items-center justify-between gap-3 px-4 py-4">
              <span>
                <span className="block font-medium text-ink">{s.title}</span>
                <span className="block text-xs text-muted">{s.text}</span>
              </span>
              <span aria-hidden className="text-muted">
                ›
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

import Link from 'next/link'

const LINKS = [
  { href: '/about', label: 'About us' },
  { href: '/how-to-order', label: 'How to order' },
  { href: '/shipping-returns', label: 'Shipping and returns' },
  { href: '/contact', label: 'Contact' },
]

export function Footer({ brandName }: { brandName: string }) {
  return (
    <footer className="mt-auto border-t border-line bg-surface pb-24 pt-8">
      <div className="mx-auto max-w-6xl px-4">
        <p className="font-display text-xl font-semibold text-accent">{brandName}</p>
        <ul className="mt-3 grid grid-cols-2 gap-2 text-sm text-ink sm:flex sm:gap-6">
          {LINKS.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="hover:text-accent">
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-xs text-muted">
          © {new Date().getFullYear()} {brandName}. Orders are confirmed on WhatsApp.
        </p>
      </div>
    </footer>
  )
}

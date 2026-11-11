import Link from 'next/link'
import { getDb } from '@/db/client'
import { requireOwner } from '@/lib/auth/guard'
import { productIdsByCode } from '@/lib/catalogue/admin'
import { requestTime } from '@/lib/clock'
import { getSettings } from '@/lib/settings/settings'
import { getSummary, type TopItem } from '@/lib/stats/stats'

function TopList({ title, items, testId, unit, codeToId }: { title: string; items: TopItem[]; testId: string; unit: string; codeToId: Map<string, number> }) {
  return (
    <section data-testid={testId} className="rounded-lg border border-line bg-surface p-4">
      <h2 className="font-display text-xl font-semibold">{title}</h2>
      <p className="text-xs text-muted">Last 7 days</p>
      {items.length ? (
        <ol className="mt-3 space-y-2">
          {items.map((item, i) => (
            <li key={item.code} className="flex items-center gap-3 text-sm">
              <span className="w-5 shrink-0 text-right text-muted">{i + 1}.</span>
              <Link href={codeToId.has(item.code) ? `/admin/products/${codeToId.get(item.code)}` : '/admin/products'} className="min-w-0 flex-1 truncate text-ink">
                {item.name}
              </Link>
              <span className="shrink-0 font-medium tabular-nums">
                {item.count} <span className="text-xs font-normal text-muted">{unit}</span>
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-3 text-sm text-muted">Nothing yet. Share product links to bring visitors.</p>
      )}
    </section>
  )
}

function Stat({ label, value, testId }: { label: string; value: number; testId: string }) {
  return (
    <div className="rounded-lg border border-line bg-surface p-3 text-center">
      <p data-testid={testId} className="text-2xl font-semibold tabular-nums text-ink">
        {value}
      </p>
      <p className="mt-0.5 text-xs leading-tight text-muted">{label}</p>
    </div>
  )
}

export default async function AdminHomePage() {
  const owner = await requireOwner()
  const db = getDb()
  const settings = getSettings(db)
  const summary = getSummary(db, requestTime())
  const codeToId = productIdsByCode(db, [...new Set([...summary.topViewed, ...summary.topOrderTaps].map((t) => t.code))])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold">Admin</h1>
        <p className="mt-1 text-sm text-muted">Welcome, {owner.name}.</p>
      </div>

      {!settings.whatsappNumber && (
        <div className="rounded-md border border-danger/40 bg-accent-soft p-3 text-sm text-ink">
          <p>WhatsApp number is not set. Order buttons are hidden.</p>
          <Link href="/admin/settings/brand" className="mt-1 inline-block font-medium text-accent underline">
            Set the number
          </Link>
        </div>
      )}

      <Link
        href="/admin/products/new"
        className="flex items-center justify-center gap-2 rounded-full bg-accent px-5 py-3.5 font-medium text-accent-ink"
      >
        + Add product
      </Link>
      <p className="-mt-3 text-center text-xs text-muted">
        Tip: in WhatsApp, select the dealer’s photos, tap Share and choose this app.
      </p>

      <div className="grid grid-cols-3 gap-2">
        <Stat label="Products live" value={summary.live} testId="stat-live" />
        <Stat label="Added this week" value={summary.addedThisWeek} testId="stat-added" />
        <Stat label="Sold this week" value={summary.soldThisWeek} testId="stat-sold" />
      </div>

      <TopList title="Most viewed" items={summary.topViewed} testId="top-viewed" unit="views" codeToId={codeToId} />
      <TopList title="Most order taps" items={summary.topOrderTaps} testId="top-taps" unit="taps" codeToId={codeToId} />
    </div>
  )
}

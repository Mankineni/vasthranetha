import { requireOwner } from '@/lib/auth/guard'

export default async function AdminHomePage() {
  const owner = await requireOwner()
  return (
    <div>
      <h1 className="font-display text-3xl font-semibold">Admin</h1>
      <p className="mt-2 text-sm text-muted">Welcome, {owner.name}.</p>
    </div>
  )
}

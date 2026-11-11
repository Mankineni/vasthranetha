import type { Db } from '@/db/client'
import { createOwner } from '@/lib/auth/sessions'

export const E2E_OWNER = { name: 'Test Owner', login: 'owner@test.local', password: 'correct-horse-battery' }

/** Creates the browser-test owner account. */
export async function createE2eOwner(db: Db): Promise<void> {
  await createOwner(db, E2E_OWNER)
}

import type { Db } from '@/db/client'

export const E2E_OWNER = { name: 'Test Owner', login: 'owner@test.local', password: 'correct-horse-battery' }

/** Creates the browser-test owner account. Filled in when sign-in exists (Task 9). */
export async function createE2eOwner(db: Db): Promise<void> {
  void db
}

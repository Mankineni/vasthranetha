import { openDb, type Db } from '@/db/client'
import { runMigrations } from '@/db/migrate'

export function createTestDb(): Db {
  const db = openDb(':memory:')
  runMigrations(db)
  return db
}

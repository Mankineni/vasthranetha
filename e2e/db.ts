// Direct access to the e2e database for cleanup after specs that change shared settings.
import { closeDb, openDb, type Db } from '../src/db/client'

export function withDb<T>(fn: (db: Db) => T): T {
  const db = openDb('./data/e2e.db')
  try {
    return fn(db)
  } finally {
    closeDb(db)
  }
}

import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema'
import { runMigrations } from './migrate'

export type Db = BetterSQLite3Database<typeof schema>
/** A transaction handle; units that may run inside a transaction accept `Db | Tx`. */
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]

const connections = new WeakMap<Db, Database.Database>()

export function openDb(file: string): Db {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(path.resolve(/*turbopackIgnore: true*/ file)), { recursive: true })
  const sqlite = new Database(file)
  sqlite.pragma('foreign_keys = ON')
  if (file !== ':memory:') sqlite.pragma('journal_mode = WAL')
  const db = drizzle(sqlite, { schema })
  connections.set(db, sqlite)
  return db
}

export function closeDb(db: Db): void {
  connections.get(db)?.close()
}

const globalForDb = globalThis as unknown as { __boutiqueDb?: Db }

export function getDb(): Db {
  if (!globalForDb.__boutiqueDb) {
    const db = openDb(process.env.DATABASE_PATH || './data/store.db')
    runMigrations(db)
    globalForDb.__boutiqueDb = db
  }
  return globalForDb.__boutiqueDb
}

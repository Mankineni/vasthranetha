// Prepares a fresh seeded database for the browser tests (npm run e2e).
// Runs before the server starts, so no open database file is ever deleted.
import fs from 'node:fs'
import path from 'node:path'
import { closeDb, openDb } from '@/db/client'
import { runMigrations } from '@/db/migrate'
import { seedDatabase } from './seed-data'
import { createE2eOwner } from './e2e-owner'

const DB = path.resolve('data/e2e.db')
const MEDIA = path.resolve('data/e2e-media')

async function main() {
  for (const f of [DB, `${DB}-wal`, `${DB}-shm`]) fs.rmSync(f, { force: true })
  fs.rmSync(MEDIA, { recursive: true, force: true })
  const db = openDb(DB)
  runMigrations(db)
  console.log('Seeding e2e database...')
  await seedDatabase(db, MEDIA, Date.now(), () => {})
  await createE2eOwner(db)
  closeDb(db)
  console.log('e2e database ready.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

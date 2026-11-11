// Fills the database with sample products: npm run seed [-- --force]
import { getDb } from '@/db/client'
import { mediaDirFromEnv } from '@/lib/media/store'
import { products } from '@/db/schema'
import { seedDatabase } from './seed-data'

async function main() {
  const db = getDb()
  if (process.argv.includes('--force')) db.delete(products).run()
  console.log('Seeding sample catalogue...')
  await seedDatabase(db, mediaDirFromEnv())
  console.log('Done.')
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})

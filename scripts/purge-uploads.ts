// Removes uploads that were never attached to a product within 24 hours.
// Run daily: npm run purge-uploads
import { getDb } from '@/db/client'
import { mediaDirFromEnv, purgeUnattached } from '@/lib/media/store'

async function main() {
  const count = await purgeUnattached(getDb(), mediaDirFromEnv(), Date.now())
  console.log(`Removed ${count} unattached upload(s).`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

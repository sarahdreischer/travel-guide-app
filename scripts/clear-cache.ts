/**
 * Delete all cached AI advice for a given trip.
 *
 * Usage:
 *   npx tsx scripts/clear-cache.ts <tripId>
 *
 * This removes all advice_cache rows matching the trip's cache key
 * (destination, months, traveller type, budget range). The next time
 * the trip page is loaded, advice will be regenerated from scratch.
 *
 * Requires DATABASE_URL in .env.local
 */

import { loadEnvConfig } from '@next/env'
loadEnvConfig(process.cwd())

async function main() {
  const { db } = await import('../src/db')
  const { trips, adviceCache } = await import('../src/db/schema')
  const { eq, and } = await import('drizzle-orm')
  const { deriveMonthRange } = await import('../src/lib/advice-store')
  const { derivebudgetRange } = await import('../src/lib/validators')

  const tripId = process.argv[2]
  if (!tripId) {
    console.error('Usage: npx tsx scripts/clear-cache.ts <tripId>')
    process.exit(1)
  }

  const [trip] = await db.select().from(trips).where(eq(trips.id, tripId)).limit(1)
  if (!trip) {
    console.error(`Trip not found: ${tripId}`)
    process.exit(1)
  }

  const { startMonth, endMonth } = deriveMonthRange(trip.startDate, trip.endDate)
  const destination = trip.destination.toLowerCase()
  const travellerType = trip.travelMode.toLowerCase()
  const budgetRange = derivebudgetRange(trip.budgetUsd)

  console.log(`\nClearing cache for: ${trip.destination}`)
  console.log(`  Cache key: ${destination} | ${startMonth}–${endMonth} | ${travellerType} | ${budgetRange}\n`)

  const deleted = await db
    .delete(adviceCache)
    .where(
      and(
        eq(adviceCache.destination, destination),
        eq(adviceCache.startMonth, startMonth),
        eq(adviceCache.endMonth, endMonth),
        eq(adviceCache.travellerType, travellerType),
        eq(adviceCache.budgetRange, budgetRange)
      )
    )
    .returning({ id: adviceCache.id })

  console.log(`✓ Deleted ${deleted.length} cached advice record(s).`)
  console.log('  Reload the trip page to regenerate advice.\n')

  process.exit(0)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})

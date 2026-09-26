/**
 * Delete the cached structured Trip Guide for a given trip.
 *
 * Usage:
 *   npx tsx scripts/clear-cache.ts <tripId>
 *
 * This removes the trip_guides row matching the trip's cache key
 * (destination, months, traveller type, budget range). The next time the trip
 * page is loaded, the two-stage pipeline regenerates the guide from scratch.
 * (Destination facts remain cached and are reused; pass a trip to a different
 * destination, or refresh facts separately, to re-research those.)
 *
 * Requires DATABASE_URL in .env.local
 */

import { loadEnvConfig } from '@next/env'
loadEnvConfig(process.cwd())

async function main() {
  const { db } = await import('../src/db')
  const { trips } = await import('../src/db/schema')
  const { eq } = await import('drizzle-orm')
  const { TripGuideStore, tripGuideKeyForTrip } = await import('../src/lib/trip-guide-store')

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

  const key = tripGuideKeyForTrip(trip)
  console.log(`\nClearing structured trip guide for: ${trip.destination}`)
  console.log(
    `  Cache key: ${key.destination} | ${key.startMonth}–${key.endMonth} | ${key.travellerType} | ${key.budgetRange}\n`
  )

  await TripGuideStore.deleteByKey(key)

  console.log('✓ Deleted cached trip guide (if one existed).')
  console.log('  Reload the trip page to regenerate it.\n')

  process.exit(0)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})

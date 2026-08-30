/**
 * Force-reconcile missing LLM answers for all trips (or a specific trip).
 *
 * Usage:
 *   npx tsx scripts/reconcile.ts              # reconcile ALL trips
 *   npx tsx scripts/reconcile.ts <tripId>     # reconcile a specific trip
 *
 * Requires DATABASE_URL and OPENAI_API_KEY in .env.local
 */

import { loadEnvConfig } from '@next/env'
loadEnvConfig(process.cwd())

async function main() {
  // Dynamic imports AFTER env is loaded so DATABASE_URL is available
  const { db } = await import('../src/db')
  const { trips } = await import('../src/db/schema')
  const { eq } = await import('drizzle-orm')
  const { AdviceStore, deriveMonthRange } = await import('../src/lib/advice-store')
  const { CATEGORIES, getSubQuestions } = await import('../src/lib/destinations')
  const { derivebudgetRange } = await import('../src/lib/validators')
  const { LLMAdapter } = await import('../src/lib/llm-adapter')
  const { findAnswer } = await import('../src/lib/answer-lookup')
  const { reconcileGroupTipsAction } = await import('../src/actions/advice')

  async function reconcileTrip(trip: typeof trips.$inferSelect) {
    const { startMonth, endMonth } = deriveMonthRange(trip.startDate, trip.endDate)
    const cacheKey = {
      destination: trip.destination.toLowerCase(),
      startMonth,
      endMonth,
      travellerType: trip.travelMode.toLowerCase(),
      budgetRange: derivebudgetRange(trip.budgetUsd),
      transportMode: (trip as { transportMode?: string | null }).transportMode ?? undefined,
      startingLocation: (trip as { startingLocation?: string | null }).startingLocation ?? undefined,
      totalBudgetUsd: trip.budgetUsd,
      transportCostIncluded: (trip as { transportCostIncluded?: boolean }).transportCostIncluded ?? true,
      tripDurationDays: Math.max(1, Math.round((new Date(trip.endDate).getTime() - new Date(trip.startDate).getTime()) / 86400000)),
      partySize: trip.travelMode.toLowerCase(),
      activities: trip.activityPreferences,
    }

    const categoriesWithQuestions = CATEGORIES.filter((c) => getSubQuestions(c).length > 0)
    const missing: { category: string; subQuestions: string[] }[] = []

    for (const category of categoriesWithQuestions) {
      const cached = await AdviceStore.findByCacheKey(cacheKey, category)
      const subQuestions = getSubQuestions(category)

      if (!cached) {
        missing.push({ category, subQuestions })
      } else {
        const answers = cached.answers as Record<string, string> | null
        const hasAll = answers && subQuestions.every((q) => findAnswer(answers, q) !== undefined)
        if (!hasAll) {
          await AdviceStore.deleteByCacheKey(cacheKey, category)
          missing.push({ category, subQuestions })
        }
      }
    }

    if (missing.length === 0) {
      console.log(`  ✓ All ${categoriesWithQuestions.length} categories complete`)
    } else {
      console.log(`  → ${missing.length} categories missing, generating...`)
      try {
        const records = await LLMAdapter.generateAdviceBatch(cacheKey, missing)
        console.log(`  ✓ Generated ${records.length}/${missing.length} categories`)
        const failed = missing.length - records.length
        if (failed > 0) console.log(`  ⚠ ${failed} categories failed`)
      } catch (err) {
        console.error(`  ✗ Generation failed:`, (err as Error).message)
      }
    }

    // Reconcile the group headline tips (generates/updates if missing or stale)
    try {
      const groupResult = await reconcileGroupTipsAction(cacheKey)
      if (groupResult.generated) console.log('  ✓ Group tips generated')
      else if (groupResult.skipped) console.log('  ✓ Group tips complete')
      else if (groupResult.rateLimited) console.log('  ⚠ Group tips skipped — rate limited')
    } catch (err) {
      console.error('  ✗ Group tips generation failed:', (err as Error).message)
    }
  }

  const tripId = process.argv[2]
  let tripsToReconcile: (typeof trips.$inferSelect)[]

  if (tripId) {
    const [trip] = await db.select().from(trips).where(eq(trips.id, tripId)).limit(1)
    if (!trip) {
      console.error(`Trip not found: ${tripId}`)
      process.exit(1)
    }
    tripsToReconcile = [trip]
  } else {
    tripsToReconcile = await db.select().from(trips)
  }

  console.log(`\nReconciling ${tripsToReconcile.length} trip(s)...\n`)

  for (const trip of tripsToReconcile) {
    console.log(`[${trip.id}] ${trip.destination} (${trip.startDate} → ${trip.endDate})`)
    await reconcileTrip(trip)
    console.log('')
  }

  console.log('Done.')
  process.exit(0)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})

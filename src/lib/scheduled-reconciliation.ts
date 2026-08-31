/**
 * Scheduled reconciliation — runs periodically to fill in missing advice
 * for all trips that have incomplete categories.
 *
 * Configurable via:
 * - RECONCILIATION_INTERVAL_MINUTES: how often to run (default: 10)
 *
 * This module self-starts when imported (side-effect). It uses a singleton
 * guard so it only runs once per process even with hot-reloading.
 */

import { db } from '@/db'
import { trips } from '@/db/schema'
import { AdviceStore, deriveMonthRange } from '@/lib/advice-store'
import { CATEGORIES, getSubQuestions } from '@/lib/destinations'
import { derivebudgetRange } from '@/lib/validators'
import { canCallAI } from '@/lib/ai-rate-limiter'
import { reconcileMissingAdviceAction } from '@/actions/advice'
import { findAnswer } from '@/lib/answer-lookup'
import { getGroupQuestions } from '@/lib/category-groups'

const GROUP_TIPS_CATEGORY = '_group_tips'

const INTERVAL_MINUTES = parseInt(process.env.RECONCILIATION_INTERVAL_MINUTES ?? '10', 10)
const INTERVAL_MS = INTERVAL_MINUTES * 60 * 1000

async function runReconciliation() {
  console.log(`[Scheduled Reconciliation] Starting — ${new Date().toISOString()}`)

  // Background job: low priority. Backs off earlier than foreground work so
  // per-minute budget stays available for new-trip advice generation.
  if (!canCallAI('low')) {
    console.log('[Scheduled Reconciliation] Skipped — rate limited (low priority backs off to leave headroom for new trips)')
    return
  }

  try {
    // Get all trips
    const allTrips = await db.select().from(trips)

    const categoriesWithQuestions = CATEGORIES.filter((c) => getSubQuestions(c).length > 0)

    let reconciled = 0
    let skipped = 0

    for (const trip of allTrips) {
      // Check if this trip has incomplete advice.
      // Count records per category and verify each category actually has all its
      // current sub-question answers (a category can exist but be stale/incomplete).
      const records = await AdviceStore.getForTrip(trip.id)
      const recordsByCategory = new Map<string, Record<string, string> | null>()
      for (const r of records) {
        recordsByCategory.set(r.category, r.answers as Record<string, string> | null)
      }

      const hasMissingOrStaleCategories = categoriesWithQuestions.some((category) => {
        const answers = recordsByCategory.get(category)
        if (!answers) return true // category not generated yet
        const subQuestions = getSubQuestions(category)
        // Stale if any current sub-question lacks an answer
        return !subQuestions.every((q) => findAnswer(answers, q) !== undefined)
      })

      // Also treat the trip as needing reconciliation if the group headline tips
      // are missing or don't cover every current group.
      const groupTipAnswers = recordsByCategory.get(GROUP_TIPS_CATEGORY)
      const groupIds = getGroupQuestions().map((g) => g.id)
      const hasMissingOrStaleGroupTips =
        !groupTipAnswers ||
        !groupIds.every((id) => typeof groupTipAnswers[id] === 'string' && groupTipAnswers[id].length > 0)

      if (!hasMissingOrStaleCategories && !hasMissingOrStaleGroupTips) {
        skipped++
        continue
      }

      // Rate limit check before each trip (low priority — leaves headroom)
      if (!canCallAI('low')) {
        console.log('[Scheduled Reconciliation] Stopping — rate limited mid-run (leaving headroom for new trips)')
        break
      }

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
        travelStyle: trip.travelStyle || undefined,
      }

      const result = await reconcileMissingAdviceAction(cacheKey, 'low')

      if (result.generated > 0) {
        reconciled++
        console.log(
          `[Scheduled Reconciliation] Trip "${trip.destination}" — generated ${result.generated} categories`
        )
      }

      if (result.rateLimited) {
        console.log('[Scheduled Reconciliation] Stopping — rate limited after attempt')
        break
      }
    }

    console.log(
      `[Scheduled Reconciliation] Done — reconciled: ${reconciled}, skipped (complete): ${skipped}, total trips: ${allTrips.length}`
    )
  } catch (error) {
    console.error('[Scheduled Reconciliation] Error:', error)
  }
}

// ─── Singleton startup guard ──────────────────────────────────────────────────

const globalKey = '__scheduledReconciliationStarted'

if (typeof globalThis !== 'undefined' && !(globalThis as Record<string, unknown>)[globalKey]) {
  (globalThis as Record<string, unknown>)[globalKey] = true

  console.log(
    `[Scheduled Reconciliation] Registered — runs every ${INTERVAL_MINUTES} minutes`
  )

  // Run once after startup (30 second delay to let the server initialize)
  setTimeout(() => {
    runReconciliation().catch(console.error)
  }, 30_000)

  // Then run on schedule
  setInterval(() => {
    runReconciliation().catch(console.error)
  }, INTERVAL_MS)
}

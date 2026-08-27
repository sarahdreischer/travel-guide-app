// Advice_Store — Requirements 4.2, 4.3, 4.6
import { db } from '@/db'
import { adviceCache, trips } from '@/db/schema'
import type { AdviceCache, NewAdviceCache } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { derivebudgetRange } from '@/lib/validators'

// ─── Types ────────────────────────────────────────────────────────────────────

export type CacheKey = {
  destination: string // normalised to lower-case
  startMonth: string // e.g. "july"
  endMonth: string // e.g. "august" (same as startMonth for single-month trips)
  travellerType: string // party type (solo/couple/friends/family)
  budgetRange: string // "budget" | "mid" | "luxury"
  transportMode?: string // optional: fly | drive | rail | sail (context only, not a cache dimension)
  // Extended context for LLM prompts (not used as cache dimensions)
  startingLocation?: string // city, country the traveller departs from
  totalBudgetUsd?: number // total budget for all travellers
  transportCostIncluded?: boolean // whether transport cost is included in total budget
  tripDurationDays?: number // number of days in the trip
  partySize?: string // e.g. "solo", "couple", "friends", "family"
  activities?: string[] // selected activity preferences
}

/**
 * Derive the month range from start and end dates.
 */
export function deriveMonthRange(startDate: string | Date, endDate: string | Date): { startMonth: string; endMonth: string } {
  const start = new Date(startDate)
  const end = new Date(endDate)
  return {
    startMonth: start.toLocaleString('en', { month: 'long' }).toLowerCase(),
    endMonth: end.toLocaleString('en', { month: 'long' }).toLowerCase(),
  }
}

export type AdviceRecord = AdviceCache
export type NewAdviceRecord = NewAdviceCache

// ─── Store Functions ──────────────────────────────────────────────────────────

/**
 * Find a cached advice record by composite cache key + category.
 * Uses the composite unique index on (destination, month, traveller_type, budget_range, category).
 * Since destination, month, and traveller_type columns are citext, comparison is case-insensitive.
 *
 * Requirements: 4.2, 4.6
 */
async function findByCacheKey(key: CacheKey, category: string): Promise<AdviceRecord | null> {
  const rows = await db
    .select()
    .from(adviceCache)
    .where(
      and(
        eq(adviceCache.destination, key.destination),
        eq(adviceCache.startMonth, key.startMonth),
        eq(adviceCache.endMonth, key.endMonth),
        eq(adviceCache.travellerType, key.travellerType),
        eq(adviceCache.budgetRange, key.budgetRange),
        eq(adviceCache.category, category),
      ),
    )
    .limit(1)

  return rows[0] ?? null
}

/**
 * Idempotent save: insert a new advice record or return the existing one if the
 * cache key + category already exists (ON CONFLICT DO NOTHING).
 * This ensures retries and concurrent calls don't produce duplicates.
 *
 * Requirements: 4.6
 */
async function save(advice: NewAdviceRecord): Promise<AdviceRecord> {
  const [row] = await db
    .insert(adviceCache)
    .values(advice)
    .onConflictDoNothing({
      target: [
        adviceCache.destination,
        adviceCache.startMonth,
        adviceCache.endMonth,
        adviceCache.travellerType,
        adviceCache.budgetRange,
        adviceCache.category,
      ],
    })
    .returning()

  // If conflict occurred, row is undefined — fetch the existing record
  if (!row) {
    const existing = await findByCacheKey(
      {
        destination: advice.destination as string,
        startMonth: advice.startMonth as string,
        endMonth: advice.endMonth as string,
        travellerType: advice.travellerType as string,
        budgetRange: advice.budgetRange as string,
      },
      advice.category as string,
    )
    return existing!
  }

  return row
}

/**
 * Get all cached advice records for a given trip.
 * Derives the cache key from the trip's details (destination, start_date month,
 * travel mode, budget tier) and returns all matching advice rows.
 *
 * Requirements: 4.3, 4.6
 */
async function getForTrip(tripId: string): Promise<AdviceRecord[]> {
  // Fetch the trip record
  const [trip] = await db.select().from(trips).where(eq(trips.id, tripId)).limit(1)

  if (!trip) {
    return []
  }

  // Derive cache key components from trip
  const { startMonth, endMonth } = deriveMonthRange(trip.startDate, trip.endDate)
  const budgetRange = derivebudgetRange(trip.budgetUsd)
  const destination = trip.destination.toLowerCase()
  const travellerType = trip.travelMode.toLowerCase()

  // Fetch all advice records matching the derived cache key (across all categories)
  const rows = await db
    .select()
    .from(adviceCache)
    .where(
      and(
        eq(adviceCache.destination, destination),
        eq(adviceCache.startMonth, startMonth),
        eq(adviceCache.endMonth, endMonth),
        eq(adviceCache.travellerType, travellerType),
        eq(adviceCache.budgetRange, budgetRange),
      ),
    )

  return rows
}

/**
 * Delete a cached advice record by cache key + category.
 * Used when a record is stale (missing answers for newly added questions).
 */
async function deleteByCacheKey(key: CacheKey, category: string): Promise<void> {
  await db
    .delete(adviceCache)
    .where(
      and(
        eq(adviceCache.destination, key.destination),
        eq(adviceCache.startMonth, key.startMonth),
        eq(adviceCache.endMonth, key.endMonth),
        eq(adviceCache.travellerType, key.travellerType),
        eq(adviceCache.budgetRange, key.budgetRange),
        eq(adviceCache.category, category),
      ),
    )
}

// ─── Export ───────────────────────────────────────────────────────────────────

export const AdviceStore = { findByCacheKey, save, getForTrip, deleteByCacheKey }

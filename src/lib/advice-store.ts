// Advice_Store — Requirements 4.2, 4.3, 4.6
import { db } from '@/db'
import { adviceCache, trips } from '@/db/schema'
import type { AdviceCache, NewAdviceCache } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { derivebudgetRange } from '@/lib/validators'

// ─── Types ────────────────────────────────────────────────────────────────────

export type CacheKey = {
  destination: string // normalised to lower-case
  month: string // e.g. "january"
  travellerType: string // travel mode
  budgetRange: string // "budget" | "mid" | "luxury"
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
        eq(adviceCache.month, key.month),
        eq(adviceCache.travellerType, key.travellerType),
        eq(adviceCache.budgetRange, key.budgetRange),
        eq(adviceCache.category, category),
      ),
    )
    .limit(1)

  return rows[0] ?? null
}

/**
 * Insert a new advice record into the cache and return the inserted row.
 *
 * Requirements: 4.6
 */
async function save(advice: NewAdviceRecord): Promise<AdviceRecord> {
  const [row] = await db.insert(adviceCache).values(advice).returning()
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
  const month = new Date(trip.startDate).toLocaleString('en', { month: 'long' }).toLowerCase()
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
        eq(adviceCache.month, month),
        eq(adviceCache.travellerType, travellerType),
        eq(adviceCache.budgetRange, budgetRange),
      ),
    )

  return rows
}

// ─── Export ───────────────────────────────────────────────────────────────────

export const AdviceStore = { findByCacheKey, save, getForTrip }

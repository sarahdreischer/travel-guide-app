/**
 * TripGuide persistence (stage-2 output).
 *
 * Keyed by the same cache dimensions as advice_cache
 * (destination, startMonth, endMonth, travellerType, budgetRange) so identical
 * trips reuse a generated guide. Links to the destination_facts row it was
 * generated from.
 */

import { db } from '@/db'
import { tripGuides } from '@/db/schema'
import type { TripGuideRow, Trip } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { TripGuideSchema, safeParseTripGuide, type TripGuide } from '@/lib/schemas/trip-guide'
import { deriveMonthRange } from '@/lib/advice-store'
import { derivebudgetRange } from '@/lib/validators'

export interface TripGuideKey {
  destination: string
  startMonth: string
  endMonth: string
  travellerType: string
  budgetRange: string
}

/**
 * Derive the TripGuide cache key from a trip row. This is the single source of
 * truth for how a trip maps to its structured-guide key, shared by the home
 * page render and the advice-status endpoint so they always agree on whether a
 * guide exists for a given trip.
 */
export function tripGuideKeyForTrip(
  trip: Pick<Trip, 'destination' | 'startDate' | 'endDate' | 'travelMode' | 'budgetUsd'>
): TripGuideKey {
  const { startMonth, endMonth } = deriveMonthRange(trip.startDate, trip.endDate)
  return {
    destination: trip.destination.toLowerCase(),
    startMonth,
    endMonth,
    travellerType: trip.travelMode.toLowerCase(),
    budgetRange: derivebudgetRange(trip.budgetUsd),
  }
}

function whereKey(key: TripGuideKey) {
  return and(
    eq(tripGuides.destination, key.destination),
    eq(tripGuides.startMonth, key.startMonth),
    eq(tripGuides.endMonth, key.endMonth),
    eq(tripGuides.travellerType, key.travellerType),
    eq(tripGuides.budgetRange, key.budgetRange),
  )
}

/** Fetch the raw row for a key, or null. */
async function findRow(key: TripGuideKey): Promise<TripGuideRow | null> {
  const rows = await db.select().from(tripGuides).where(whereKey(key)).limit(1)
  return rows[0] ?? null
}

/** Fetch the validated TripGuide for a key, or null. */
async function get(key: TripGuideKey): Promise<TripGuide | null> {
  const row = await findRow(key)
  if (!row) return null
  const parsed = safeParseTripGuide(row.guide)
  if (!parsed.success) {
    console.warn(`[trip-guide-store] Cached guide for "${key.destination}" failed validation — treating as absent`)
    return null
  }
  return parsed.data
}

/** Upsert a validated TripGuide for a key. */
async function save(
  key: TripGuideKey,
  guide: TripGuide,
  destinationFactsId?: string | null
): Promise<TripGuide> {
  const validated = TripGuideSchema.parse(guide)

  await db
    .insert(tripGuides)
    .values({
      destination: key.destination,
      startMonth: key.startMonth,
      endMonth: key.endMonth,
      travellerType: key.travellerType,
      budgetRange: key.budgetRange,
      guide: validated,
      destinationFactsId: destinationFactsId ?? null,
    })
    .onConflictDoUpdate({
      target: [
        tripGuides.destination,
        tripGuides.startMonth,
        tripGuides.endMonth,
        tripGuides.travellerType,
        tripGuides.budgetRange,
      ],
      set: { guide: validated, destinationFactsId: destinationFactsId ?? null, generatedAt: new Date() },
    })

  return validated
}

/**
 * Lightweight readiness check: is a VALID structured guide cached for this key?
 * Used by the advice-status endpoint to report structured-guide progress
 * without shipping the whole guide payload.
 */
async function isReady(key: TripGuideKey): Promise<boolean> {
  const row = await findRow(key)
  if (!row) return false
  return safeParseTripGuide(row.guide).success
}

/** Delete the guide for a key (used to force regeneration). */
async function deleteByKey(key: TripGuideKey): Promise<void> {
  await db.delete(tripGuides).where(whereKey(key))
}

export const TripGuideStore = { get, findRow, save, deleteByKey, isReady }

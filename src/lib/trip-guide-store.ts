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
import { deriveMonthRange } from '@/lib/trip-cache-key'
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

/** A cached guide plus its completeness metadata. */
export interface CachedTripGuide {
  guide: TripGuide
  complete: boolean
  attemptedTopics: string[] | null
  /** Question-library ids this guide covers, or null for legacy rows. */
  coveredQuestions: string[] | null
}

/** Fetch the validated TripGuide for a key, or null. */
async function get(key: TripGuideKey): Promise<TripGuide | null> {
  const record = await getRecord(key)
  return record?.guide ?? null
}

/**
 * Fetch the validated guide plus completeness metadata for a key, or null.
 * Used by on-view reconciliation to decide whether to top up missing topics.
 */
async function getRecord(key: TripGuideKey): Promise<CachedTripGuide | null> {
  const row = await findRow(key)
  if (!row) return null
  const parsed = safeParseTripGuide(row.guide)
  if (!parsed.success) {
    console.warn(`[trip-guide-store] Cached guide for "${key.destination}" failed validation — treating as absent`)
    return null
  }
  const toStringArray = (v: unknown): string[] | null =>
    Array.isArray(v) ? (v as unknown[]).filter((t): t is string => typeof t === 'string') : null
  return {
    guide: parsed.data,
    complete: row.complete,
    attemptedTopics: toStringArray(row.attemptedTopics),
    coveredQuestions: toStringArray(row.coveredQuestions),
  }
}

export interface SaveOptions {
  destinationFactsId?: string | null
  complete?: boolean
  attemptedTopics?: string[] | null
  coveredQuestions?: string[] | null
}

/** Upsert a validated TripGuide (plus completeness metadata) for a key. */
async function save(
  key: TripGuideKey,
  guide: TripGuide,
  options: SaveOptions = {}
): Promise<TripGuide> {
  const validated = TripGuideSchema.parse(guide)
  const {
    destinationFactsId = null,
    complete = true,
    attemptedTopics = null,
    coveredQuestions = null,
  } = options

  await db
    .insert(tripGuides)
    .values({
      destination: key.destination,
      startMonth: key.startMonth,
      endMonth: key.endMonth,
      travellerType: key.travellerType,
      budgetRange: key.budgetRange,
      guide: validated,
      destinationFactsId,
      complete,
      attemptedTopics,
      coveredQuestions,
    })
    .onConflictDoUpdate({
      target: [
        tripGuides.destination,
        tripGuides.startMonth,
        tripGuides.endMonth,
        tripGuides.travellerType,
        tripGuides.budgetRange,
      ],
      set: {
        guide: validated,
        destinationFactsId,
        complete,
        attemptedTopics,
        coveredQuestions,
        generatedAt: new Date(),
      },
    })

  return validated
}

/**
 * Merge freshly generated topics into an existing guide. Topics with the same
 * topicId are replaced; new topics are appended. The tripSummary and topic
 * order of the base guide are preserved (new topics appended at the end).
 * Pure — does not touch the DB.
 */
function mergeTopics(base: TripGuide, freshTopics: TripGuide['topics']): TripGuide {
  const freshById = new Map(freshTopics.map((t) => [t.topicId, t]))
  const merged = base.topics.map((t) => freshById.get(t.topicId) ?? t)
  const existingIds = new Set(base.topics.map((t) => t.topicId))
  for (const t of freshTopics) {
    if (!existingIds.has(t.topicId)) merged.push(t)
  }
  return { tripSummary: base.tripSummary, topics: merged }
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

export const TripGuideStore = { get, getRecord, findRow, save, deleteByKey, isReady, mergeTopics }

'use server'

/**
 * Trip Guide server actions — the two-stage generation orchestration:
 *
 *   Trip
 *   → Destination Research (cached DestinationFacts)
 *   → Structured Trip Guide Generation
 *   → validated TripGuide (persisted, reusable per trip cache key)
 *
 * This is additive: the legacy single-stage advice flow (actions/advice.ts)
 * remains untouched. The two-stage path is used where wired in, and both stages
 * cache independently so destination facts are reused across trips.
 */

import { DestinationFactsStore } from '@/lib/destination-facts-store'
import { TripGuideStore, type TripGuideKey } from '@/lib/trip-guide-store'
import { generateTripGuide, type TripGuideInput } from '@/lib/trip-guide-generator'
import { splitDestination } from '@/lib/destination-parse'
import { deriveMonthRange } from '@/lib/advice-store'
import { derivebudgetRange } from '@/lib/validators'
import type { AICallPriority } from '@/lib/ai-rate-limiter'
import type { TripGuide } from '@/lib/schemas/trip-guide'
import type { DestinationFacts } from '@/lib/schemas/destination-facts'

// ─── Types ────────────────────────────────────────────────────────────────────

/** The trip fields needed to drive the two-stage pipeline. */
export interface TripGuideRequest {
  destination: string // "City, Country" (as stored on the trip)
  startDate: string | Date
  endDate: string | Date
  travellerType: string // Solo | Couple | Friends | Family (any case)
  budgetUsd: number
  transportMode?: string | null
  startingLocation?: string | null
  transportCostIncluded?: boolean
  activities?: string[]
  travelStyle?: string | null // e.g. "Adventure, Relaxed"
}

export type TripGuideResult =
  | { status: 'success'; guide: TripGuide; facts: DestinationFacts; cached: boolean }
  | { status: 'error'; message: string }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function nightsBetween(start: string | Date, end: string | Date): number {
  return Math.max(1, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86_400_000))
}

function parseTravelStyles(raw: string | null | undefined): string[] {
  if (!raw) return []
  return raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
}

function deriveKey(req: TripGuideRequest): TripGuideKey {
  const { startMonth, endMonth } = deriveMonthRange(req.startDate, req.endDate)
  return {
    destination: req.destination.toLowerCase(),
    startMonth,
    endMonth,
    travellerType: req.travellerType.toLowerCase(),
    budgetRange: derivebudgetRange(req.budgetUsd),
  }
}

// ─── Server actions ─────────────────────────────────────────────────────────

/**
 * Get or generate the structured TripGuide for a trip.
 *
 * 1. Return the cached guide if present (reuses across identical trips).
 * 2. Otherwise: get-or-research the DestinationFacts (cached across ALL trips
 *    to that destination), generate the guide, persist, and return it.
 */
export async function getOrGenerateTripGuideAction(
  req: TripGuideRequest,
  priority: AICallPriority = 'high'
): Promise<TripGuideResult> {
  const key = deriveKey(req)
  const { destination, country } = splitDestination(req.destination)

  try {
    // 1. Cache hit on the assembled guide.
    const cachedGuide = await TripGuideStore.get(key)
    if (cachedGuide) {
      // We still return facts for callers that want them; read from cache.
      const facts = await DestinationFactsStore.get(destination, country)
      if (facts) {
        return { status: 'success', guide: cachedGuide, facts, cached: true }
      }
      // Guide cached but facts missing (e.g. pruned) — return the guide with a
      // freshly researched-or-cached facts object for completeness.
      const freshFacts = await DestinationFactsStore.getOrResearch(destination, country, { priority })
      return { status: 'success', guide: cachedGuide, facts: freshFacts, cached: true }
    }

    // 2a. Stage 1 — destination research (cached & reusable across trips).
    const facts = await DestinationFactsStore.getOrResearch(destination, country, { priority })
    const factsRow = await DestinationFactsStore.findRow(destination, country)

    // 2b. Stage 2 — structured trip guide generation.
    const tripInput: TripGuideInput = {
      destination,
      country,
      nights: nightsBetween(req.startDate, req.endDate),
      travellerType: req.travellerType.toLowerCase(),
      travelStyles: parseTravelStyles(req.travelStyle),
      transportMode: req.transportMode ?? undefined,
      startingLocation: req.startingLocation ?? undefined,
      totalBudgetUsd: req.budgetUsd,
      transportCostIncluded: req.transportCostIncluded ?? true,
      activities: req.activities,
    }

    const guide = await generateTripGuide({ trip: tripInput, facts, priority })

    // 2c. Persist for reuse.
    const persisted = await TripGuideStore.save(key, guide, factsRow?.id ?? null)

    return { status: 'success', guide: persisted, facts, cached: false }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Trip guide generation failed'
    console.error('[getOrGenerateTripGuide] Failed:', error)
    return { status: 'error', message }
  }
}

/**
 * Manually refresh the researched destination facts for a destination string,
 * independently of any individual trip guide.
 */
export async function refreshDestinationFactsAction(
  destinationString: string,
  priority: AICallPriority = 'high'
): Promise<{ status: 'success'; facts: DestinationFacts } | { status: 'error'; message: string }> {
  const { destination, country } = splitDestination(destinationString)
  try {
    const facts = await DestinationFactsStore.refresh(destination, country, priority)
    return { status: 'success', facts }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Destination refresh failed'
    console.error('[refreshDestinationFacts] Failed:', error)
    return { status: 'error', message }
  }
}

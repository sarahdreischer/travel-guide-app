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
import { generateTripGuide, relevantTopicIds, type TripGuideInput } from '@/lib/trip-guide-generator'
import { splitDestination } from '@/lib/destination-parse'
import { deriveMonthRange } from '@/lib/trip-cache-key'
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

/** Build the generator's TripGuideInput from a request + split destination. */
function buildTripInput(
  req: TripGuideRequest,
  destination: string,
  country: string
): TripGuideInput {
  return {
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

  const tripInput = buildTripInput(req, destination, country)

  try {
    // 1. Cache hit on the assembled guide.
    const cached = await TripGuideStore.getRecord(key)
    if (cached) {
      const facts =
        (await DestinationFactsStore.get(destination, country)) ??
        (await DestinationFactsStore.getOrResearch(destination, country, { priority }))

      // 1a. On-view reconciliation: if the cached guide is incomplete, retry
      // ONLY the relevant topics that never reached a terminal state (missing
      // or previously failed) — never the ones the model intentionally left
      // empty. Merge the results and re-persist.
      if (!cached.complete) {
        const guide = await reconcileGuide({
          key,
          cached,
          tripInput,
          facts,
          destination,
          country,
          priority,
        })
        return { status: 'success', guide, facts, cached: true }
      }

      return { status: 'success', guide: cached.guide, facts, cached: true }
    }

    // 2a. Stage 1 — destination research (cached & reusable across trips).
    const facts = await DestinationFactsStore.getOrResearch(destination, country, { priority })
    const factsRow = await DestinationFactsStore.findRow(destination, country)

    // 2b. Stage 2 — structured trip guide generation.
    const { guide, meta } = await generateTripGuide({ trip: tripInput, facts, priority })

    // 2c. Persist for reuse, recording completeness for on-view reconciliation.
    const persisted = await TripGuideStore.save(key, guide, {
      destinationFactsId: factsRow?.id ?? null,
      complete: meta.complete,
      attemptedTopics: meta.resolvedTopicIds,
    })

    return { status: 'success', guide: persisted, facts, cached: false }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Trip guide generation failed'
    console.error('[getOrGenerateTripGuide] Failed:', error)
    return { status: 'error', message }
  }
}

/**
 * On-view reconciliation of an incomplete cached guide.
 *
 * Retries only the relevant topics that never reached a terminal state — i.e.
 * (relevant topics) minus (topics already produced or intentionally left empty,
 * recorded in `attemptedTopics`). Topics the model deliberately omitted are
 * never retried. Regenerated topics are merged into the cached guide and the
 * row's completeness is recomputed and re-persisted.
 *
 * Falls back gracefully: if reconciliation can't run (rate limited) or produces
 * nothing, the existing cached guide is returned unchanged.
 */
async function reconcileGuide(args: {
  key: TripGuideKey
  cached: import('@/lib/trip-guide-store').CachedTripGuide
  tripInput: TripGuideInput
  facts: DestinationFacts
  destination: string
  country: string
  priority: AICallPriority
}): Promise<TripGuide> {
  const { key, cached, tripInput, facts, destination, country, priority } = args

  const relevant = relevantTopicIds(facts, tripInput)
  // Resolved = produced (present in the guide) ∪ intentionally-empty
  // (recorded in attemptedTopics). Anything relevant but unresolved is retried.
  const resolved = new Set<string>([
    ...cached.guide.topics.map((t) => t.topicId),
    ...(cached.attemptedTopics ?? []),
  ])
  const missing = relevant.filter((id) => !resolved.has(id))

  if (missing.length === 0) {
    // Nothing left to retry — the guide is actually complete. Persist that so
    // we stop reconciling on every view.
    await TripGuideStore.save(key, cached.guide, {
      destinationFactsId: (await DestinationFactsStore.findRow(destination, country))?.id ?? null,
      complete: true,
      attemptedTopics: relevant,
    })
    return cached.guide
  }

  console.log('[getOrGenerateTripGuide] Reconciling incomplete guide — retrying topics:', missing)

  try {
    const { guide: partial, meta } = await generateTripGuide({
      trip: tripInput,
      facts,
      priority,
      topicIds: missing,
    })

    const merged = TripGuideStore.mergeTopics(cached.guide, partial.topics)

    // Recompute completeness across the whole guide: complete when no relevant
    // topic is still unresolved after this pass.
    const nowResolved = new Set<string>([
      ...merged.topics.map((t) => t.topicId),
      ...(cached.attemptedTopics ?? []),
      ...meta.resolvedTopicIds,
    ])
    const stillMissing = relevant.filter((id) => !nowResolved.has(id))
    const factsRow = await DestinationFactsStore.findRow(destination, country)

    const persisted = await TripGuideStore.save(key, merged, {
      destinationFactsId: factsRow?.id ?? null,
      complete: stillMissing.length === 0,
      attemptedTopics: [...nowResolved].filter((id) => relevant.includes(id)),
    })
    return persisted
  } catch (error: unknown) {
    // Reconciliation is best-effort — never fail the page over it. Keep serving
    // the existing (incomplete) cached guide; it'll be retried on a later view.
    console.error('[getOrGenerateTripGuide] Reconciliation failed — serving cached guide:', error)
    return cached.guide
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

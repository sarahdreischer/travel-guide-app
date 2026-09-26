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
import { generateTripGuide, relevantTopicIds, relevantQuestionIds, type TripGuideInput } from '@/lib/trip-guide-generator'
import { getQuestionById } from '@/lib/question-library'
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
// In-flight de-duplication: concurrent calls for the same trip cache key share
// one promise. This matters now that BOTH the /generating loading screen and
// (previously) other entry points can trigger generation — e.g. refreshing the
// loading screen mid-generation. Persistence is idempotent regardless, but this
// avoids redundant duplicate LLM work on a single server instance.
const inFlight = new Map<string, Promise<TripGuideResult>>()

function inFlightKey(key: TripGuideKey): string {
  return `${key.destination}|${key.startMonth}|${key.endMonth}|${key.travellerType}|${key.budgetRange}`
}

export async function getOrGenerateTripGuideAction(
  req: TripGuideRequest,
  priority: AICallPriority = 'high'
): Promise<TripGuideResult> {
  const key = deriveKey(req)
  const dedupeKey = inFlightKey(key)

  const existing = inFlight.get(dedupeKey)
  if (existing) return existing

  const promise = runGetOrGenerateTripGuide(req, key, priority).finally(() => {
    inFlight.delete(dedupeKey)
  })
  inFlight.set(dedupeKey, promise)
  return promise
}

async function runGetOrGenerateTripGuide(
  req: TripGuideRequest,
  key: TripGuideKey,
  priority: AICallPriority
): Promise<TripGuideResult> {
  const { destination, country } = splitDestination(req.destination)

  const tripInput = buildTripInput(req, destination, country)

  try {
    // 1. Cache hit on the assembled guide.
    const cached = await TripGuideStore.getRecord(key)
    if (cached) {
      const facts =
        (await DestinationFactsStore.get(destination, country)) ??
        (await DestinationFactsStore.getOrResearch(destination, country, { priority }))

      // 1a. On-view reconciliation. The cached guide is reconciled when EITHER:
      //   - it's incomplete (a topic previously failed / was short-circuited), OR
      //   - the question library has grown since it was generated (a relevant
      //     question id it doesn't cover — e.g. a newly added question).
      // Reconciliation regenerates only the affected topics, so existing trips
      // pick up new questions on open without a full regeneration.
      const missingQuestions = missingCoveredQuestions(cached, facts, tripInput)
      if (!cached.complete || missingQuestions.length > 0) {
        const guide = await reconcileGuide({
          key,
          cached,
          tripInput,
          facts,
          destination,
          country,
          priority,
          missingQuestions,
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

    // 2c. Persist for reuse, recording completeness + question coverage for
    // on-view reconciliation.
    const persisted = await TripGuideStore.save(key, guide, {
      destinationFactsId: factsRow?.id ?? null,
      complete: meta.complete,
      attemptedTopics: meta.resolvedTopicIds,
      coveredQuestions: meta.coveredQuestionIds,
    })

    return { status: 'success', guide: persisted, facts, cached: false }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Trip guide generation failed'
    console.error('[getOrGenerateTripGuide] Failed:', error)
    return { status: 'error', message }
  }
}

type CachedTripGuide = import('@/lib/trip-guide-store').CachedTripGuide

/**
 * The question ids a cached guide effectively covers.
 *
 *  - If `coveredQuestions` was persisted (guides generated after that feature
 *    landed), use it directly.
 *  - For legacy rows (null), derive coverage from the question ids already
 *    present in the guide's items. This is deliberately conservative: it treats
 *    only genuinely NEW library questions as missing, so we never mass-retry a
 *    legacy guide's intentionally-omitted questions.
 */
function effectiveCoveredQuestions(cached: CachedTripGuide): Set<string> {
  if (cached.coveredQuestions) return new Set(cached.coveredQuestions)
  const ids = new Set<string>()
  for (const t of cached.guide.topics) {
    for (const item of t.items) ids.add(item.questionId)
  }
  return ids
}

/**
 * Relevant question ids the cached guide does NOT cover — i.e. questions added
 * to the library since it was generated. These drive question-level top-ups.
 */
function missingCoveredQuestions(
  cached: CachedTripGuide,
  facts: DestinationFacts,
  trip: TripGuideInput
): string[] {
  const covered = effectiveCoveredQuestions(cached)
  return relevantQuestionIds(facts, trip).filter((id) => !covered.has(id))
}

/** Map question ids to their (distinct) topic ids via the question library. */
function topicsForQuestions(questionIds: string[]): string[] {
  const topics = new Set<string>()
  for (const id of questionIds) {
    const topicId = getQuestionById(id)?.topicId
    if (topicId) topics.add(topicId)
  }
  return [...topics]
}

/**
 * On-view reconciliation of a stale cached guide.
 *
 * Regenerates only the AFFECTED topics — the union of:
 *   - relevant topics that never reached a terminal state (topic-level
 *     incompleteness: a topic that previously failed / was short-circuited), and
 *   - the topics of any relevant questions the guide doesn't cover yet
 *     (question-level staleness: a question added to the library after the
 *     guide was generated).
 * Topics the model intentionally omitted are never retried. Regenerated topics
 * are merged in; completeness and question coverage are recomputed and saved.
 *
 * Best-effort: if reconciliation can't run (rate limited) or fails, the
 * existing cached guide is returned unchanged and retried on a later view.
 */
async function reconcileGuide(args: {
  key: TripGuideKey
  cached: CachedTripGuide
  tripInput: TripGuideInput
  facts: DestinationFacts
  destination: string
  country: string
  priority: AICallPriority
  missingQuestions: string[]
}): Promise<TripGuide> {
  const { key, cached, tripInput, facts, destination, country, priority, missingQuestions } = args

  const relevantTopics = relevantTopicIds(facts, tripInput)
  const relevantQuestions = relevantQuestionIds(facts, tripInput)
  const covered = effectiveCoveredQuestions(cached)

  // Topic-level unresolved: relevant topics neither present nor intentionally
  // empty (recorded in attemptedTopics).
  const resolvedTopics = new Set<string>([
    ...cached.guide.topics.map((t) => t.topicId),
    ...(cached.attemptedTopics ?? []),
  ])
  const missingTopics = relevantTopics.filter((id) => !resolvedTopics.has(id))

  // Affected = topic-level gaps ∪ topics of newly-added questions.
  const affected = [...new Set([...missingTopics, ...topicsForQuestions(missingQuestions)])]

  if (affected.length === 0) {
    // Nothing to regenerate — the guide is actually up to date. Persist that so
    // we stop reconciling on every view (covers the whole relevant question set).
    await TripGuideStore.save(key, cached.guide, {
      destinationFactsId: (await DestinationFactsStore.findRow(destination, country))?.id ?? null,
      complete: true,
      attemptedTopics: relevantTopics,
      coveredQuestions: [...new Set([...covered, ...relevantQuestions])].filter((id) =>
        relevantQuestions.includes(id)
      ),
    })
    return cached.guide
  }

  console.log('[getOrGenerateTripGuide] Reconciling stale guide — regenerating topics:', affected, {
    missingTopics,
    missingQuestions,
  })

  try {
    const { guide: partial, meta } = await generateTripGuide({
      trip: tripInput,
      facts,
      priority,
      topicIds: affected,
    })

    const merged = TripGuideStore.mergeTopics(cached.guide, partial.topics)

    // Recompute topic resolution and question coverage after this pass.
    const nowResolvedTopics = new Set<string>([
      ...merged.topics.map((t) => t.topicId),
      ...(cached.attemptedTopics ?? []),
      ...meta.resolvedTopicIds,
    ])
    const nowCovered = new Set<string>([...covered, ...meta.coveredQuestionIds])

    const topicsStillMissing = relevantTopics.some((id) => !nowResolvedTopics.has(id))
    const questionsStillMissing = relevantQuestions.some((id) => !nowCovered.has(id))
    const factsRow = await DestinationFactsStore.findRow(destination, country)

    const persisted = await TripGuideStore.save(key, merged, {
      destinationFactsId: factsRow?.id ?? null,
      complete: !topicsStillMissing && !questionsStillMissing,
      attemptedTopics: [...nowResolvedTopics].filter((id) => relevantTopics.includes(id)),
      coveredQuestions: [...nowCovered].filter((id) => relevantQuestions.includes(id)),
    })
    return persisted
  } catch (error: unknown) {
    // Reconciliation is best-effort — never fail the page over it. Keep serving
    // the existing (stale) cached guide; it'll be retried on a later view.
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

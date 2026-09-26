/**
 * Structured Trip Guide generation (stage 2).
 *
 * Given a trip + validated DestinationFacts + the relevant subset of the
 * question library, generate a personalised, structured TripGuide.
 *
 * Responsibilities kept strictly separate from destination research:
 *   - Destination research answers "what stable facts do we know?"
 *   - This stage answers "given those facts and THIS traveller's trip, what
 *     should they know and decide?"
 *
 * Generation is PER-TOPIC rather than one giant object. A single call that has
 * to emit the whole guide (every topic × items × claims/entities) frequently
 * fails schema validation on smaller models ("No object generated: response
 * did not match schema"). Generating one topic at a time keeps each schema and
 * output small and reliable, lets us recover malformed JSON per topic, and
 * means one bad topic no longer discards the whole guide (partial success).
 *
 * Every externally verifiable statement is extracted into `claims[]` and
 * flagged for the FUTURE verification pipeline (not verified here). Claims are
 * defensively normalised so risk/verification invariants always hold.
 *
 * Reuses the existing AI SDK setup (generateObject + @ai-sdk/openai) and the
 * shared rate limiter.
 */

import { generateObject } from 'ai'
import { openai } from '@ai-sdk/openai'
import { z } from 'zod'
import {
  TripGuideSchema,
  TopicSummarySchema,
  GuideItemSchema,
  normaliseClaim,
  type TripGuide,
  type Topic,
} from '@/lib/schemas/trip-guide'
import type { DestinationFacts } from '@/lib/schemas/destination-facts'
import { QUESTION_LIBRARY, type QuestionDef } from '@/lib/question-library'
import { canCallAI, recordAICall, recordAIFailure, getRateLimitStatus } from '@/lib/ai-rate-limiter'
import type { AICallPriority } from '@/lib/ai-rate-limiter'
import { AIRateLimitedError, AdviceTimeoutError, isProviderFailure } from '@/lib/ai-errors'

// ─── Config ─────────────────────────────────────────────────────────────────

function getModel() {
  const modelId = process.env.AI_MODEL ?? 'gpt-4o-mini'
  return openai(modelId)
}

const GUIDE_TIMEOUT_MS = parseInt(process.env.AI_GUIDE_TIMEOUT_MS ?? '90000', 10)
// Per-topic output budget. A single topic's items comfortably fit well under
// this; kept modest so responses stay fast and within the model's budget.
const TOPIC_MAX_OUTPUT_TOKENS = parseInt(process.env.AI_GUIDE_TOPIC_MAX_OUTPUT_TOKENS ?? '2048', 10)

// Per-topic response schema — much smaller than the whole TripGuide, so the
// model matches it reliably.
const TopicResponseSchema = z.object({
  summary: TopicSummarySchema,
  items: z.array(GuideItemSchema),
})
type TopicResponse = z.infer<typeof TopicResponseSchema>

// ─── Trip input ─────────────────────────────────────────────────────────────

export interface TripGuideInput {
  destination: string
  country: string
  nights: number
  travellerType: string // solo | couple | friends | family
  travelStyles: string[] // e.g. ["adventure", "relaxed"]
  transportMode?: string // fly | drive | rail | sail
  startingLocation?: string
  totalBudgetUsd?: number
  transportCostIncluded?: boolean
  activities?: string[]
}

// ─── Relevance pre-filter ──────────────────────────────────────────────────

/**
 * Pre-filter the question library to the questions that are plausibly relevant
 * to THIS destination + trip, using DestinationFacts and the trip's transport
 * mode. This is a coarse filter — the model still decides final inclusion — but
 * it means we never even offer, say, train questions for a destination whose
 * facts establish there are no trains.
 *
 * Only EXCLUDES on a confident negative:
 *  - transport-mode-gated questions when the fact is explicitly `false`
 *    (never on `null`/unknown — "not found" is not "does not exist").
 *  - trip-transport-mode-gated questions when the trip uses a different mode.
 */
export function selectRelevantQuestions(
  facts: DestinationFacts,
  trip: Pick<TripGuideInput, 'transportMode'>
): QuestionDef[] {
  return QUESTION_LIBRARY.filter((q) => {
    const rules = q.relevanceRules
    if (!rules) return true

    if (rules.requiresTransportMode) {
      const present = facts.transport[rules.requiresTransportMode]
      // Exclude ONLY when explicitly established as absent (false). Keep when
      // true or unknown (null).
      if (present === false) return false
    }

    if (rules.requiresTripTransportMode && trip.transportMode) {
      if (trip.transportMode.toLowerCase() !== rules.requiresTripTransportMode) return false
    }

    return true
  })
}

/** Group questions by topicId, preserving first-seen topic order. */
function groupByTopic(questions: QuestionDef[]): { topicId: string; questions: QuestionDef[] }[] {
  const order: string[] = []
  const byTopic = new Map<string, QuestionDef[]>()
  for (const q of questions) {
    if (!byTopic.has(q.topicId)) {
      byTopic.set(q.topicId, [])
      order.push(q.topicId)
    }
    byTopic.get(q.topicId)!.push(q)
  }
  return order.map((topicId) => ({ topicId, questions: byTopic.get(topicId)! }))
}

// ─── Prompt ─────────────────────────────────────────────────────────────────

function describeBudget(trip: TripGuideInput): string {
  if (!trip.totalBudgetUsd) return 'Budget: not specified.'
  const incl = trip.transportCostIncluded
    ? ' (this total INCLUDES getting there — estimate and subtract travel costs before daily spend)'
    : ' (this total EXCLUDES getting there — it is destination spending money)'
  return `Total budget: $${trip.totalBudgetUsd.toLocaleString()} USD for ${trip.nights} night(s)${incl}.`
}

function tripBlock(trip: TripGuideInput): string {
  const stylesLine = trip.travelStyles.length ? trip.travelStyles.join(', ') : 'unspecified'
  const activitiesLine = trip.activities?.length ? trip.activities.join(', ') : 'none specified'
  return `TRIP:
- Destination: ${trip.destination}, ${trip.country}
- Nights: ${trip.nights}
- Traveller type: ${trip.travellerType}
- Travel styles: ${stylesLine}
- Arrival / primary transport: ${trip.transportMode ?? 'unspecified'}
- Starting location: ${trip.startingLocation ?? 'unspecified'}
- Planned activities: ${activitiesLine}
- ${describeBudget(trip)}`
}

function factsBlock(facts: DestinationFacts): string {
  return JSON.stringify(
    {
      destination: facts.destination,
      country: facts.country,
      currency: facts.currency,
      drivingSide: facts.drivingSide,
      languages: facts.languages,
      transport: facts.transport,
      geography: facts.geography,
    },
    null,
    2
  )
}

/**
 * Build the per-topic generation prompt. Scoped to ONE topic's questions so the
 * model produces a small, reliable object. Incorporates the intermediate-
 * representation guidance: recommendations vs atomic claims, entities, budget
 * reasoning, conservative health/safety/legal handling, and "omit rather than
 * fabricate".
 */
function buildTopicPrompt(
  trip: TripGuideInput,
  facts: DestinationFacts,
  topicId: string,
  questions: QuestionDef[]
): string {
  const questionBlock = questions
    .map(
      (q) =>
        `- ${q.id} [answerType=${q.answerType}, risk=${q.risk}, volatility=${q.volatility}${q.maxRecommendations ? `, maxRecommendations=${q.maxRecommendations}` : ''}]: ${q.question}`
    )
    .join('\n')

  return `You are the structured Trip Guide generation engine. You generate personalised, structured travel guidance for ONE traveller and their specific trip. This is an INTERMEDIATE representation that will later be fact-checked, checked for consistency, possibly regenerated, then converted into final prose — you are NOT writing the final user-facing article. Return ONLY valid JSON matching the supplied schema.

You are generating the guidance for a SINGLE topic: "${topicId}".

${tripBlock(trip)}

DESTINATION FACTS (baseline factual context — do NOT contradict; do NOT infer something is absent just because it isn't listed; if a transport mode is false, do not assume it exists; if unknown, don't make a definitive claim):
${factsBlock(facts)}

QUESTIONS FOR THIS TOPIC (the library is NOT a checklist — include ONLY the questions that are relevant and useful for THIS trip; it is correct to include a subset):
${questionBlock}

PRIMARY OBJECTIVE
Generate the most useful guidance for THIS traveller: given this trip, destination and budget, what should they know and what decisions should they make? Prefer fewer strong recommendations over many weak ones. Do not aim for coverage.

QUESTION SELECTION & PRIORITY
- priority "high": important decisions, safety issues, significant budget considerations, or info that materially improves the trip.
- priority "medium": useful planning info.
- priority "low": useful but non-essential.
- Omit irrelevant questions entirely. Do not emit empty/superficial items to increase coverage.
- Use destinationFacts for applicability (e.g. if a transport mode is false, don't produce guidance assuming it; if rideHailing is empty, don't recommend ride-hailing as available).

RECOMMENDATIONS vs CLAIMS
- Put judgement/decisions in "recommendation" and trip-specific reasoning in "why".
- Every externally verifiable factual statement goes in "claims[]" as an ATOMIC claim. Do not hide factual assertions inside recommendations.
- Do NOT fabricate. If you can't establish something confidently: omit it, give a cautious recommendation without asserting an unsupported fact, or include the claim marked as requiring verification. Never turn uncertainty into certainty.

CLAIMS — each claim has: claim, type, risk, volatility, verificationRequired, requiresAuthoritativeSource, verificationStatus.
- type ∈ stable_fact, current_fact, price, named_entity, transport, opening_hours, weather, health, visa, legal, safety, connectivity, geography, other.
- HIGH RISK (risk="high", verificationRequired=true, requiresAuthoritativeSource=true): visa/entry/immigration, health, vaccination, medication, legal/driving-licence requirements, safety, travel restrictions. Never present uncertain high-risk info as established fact.
- VOLATILE (volatility="volatile", verificationRequired=true): prices, availability, opening hours, transport fares, SIM/eSIM prices, current restrictions/entry/health guidance.
- Seasonal weather: type="weather", volatility="seasonal", verificationRequired=true. Distinguish seasonal expectation from an actual forecast (you don't have a forecast).
- verificationStatus: "needs_verification" when verificationRequired is true, otherwise "not_checked".

ENTITIES — any named hotel/hostel/holiday_rental/restaurant/bar/attraction/tour_operator/transport_provider/neighbourhood/beach/other you mention goes in "entities[]". Do NOT invent named entities. Factual assertions about a named entity (location, status, price) must also appear as claims requiring verification. Respect any maxRecommendations. Present options as "good fit"/"worth considering", not an objective ranking or a universal "best".

PRICES & BUDGET — don't invent precise prices; if a range is useful, mark it volatile + needs_verification. Use the traveller's ACTUAL budget and reason about trade-offs (accommodation/food/transport/activities/buffer); do not just divide total by nights and repeat it.

STYLE — concise, specific, practical, decision-oriented. Avoid generic travel-blog prose, marketing language, filler, repeated destination descriptions, and statements that could apply to any destination. Do not repeat the same information across items.

EMPTY VALUES — use null for recommendation/why/answer when they genuinely don't apply; use [] for empty entities/claims/actions. Don't manufacture content to fill fields.

OUTPUT (JSON only, matching the schema):
- summary: { headline, recommendation } — the key takeaway and primary recommendation for this topic.
- items[]: each { questionId (exact stable ID from the list above), priority (high|medium|low), applicability, recommendation|null, why|null, answer|null, entities[], claims[], actions[] }.
Include only relevant items. If NONE of this topic's questions are relevant to this trip, return an empty items array.
Do NOT include citations, URLs, markdown, or any text outside the JSON.`
}

// ─── Post-processing ───────────────────────────────────────────────────────

/** Normalise a topic's items (defensively enforce claim invariants). */
function normaliseTopic(topicId: string, resp: TopicResponse): Topic {
  return {
    topicId,
    summary: resp.summary,
    items: resp.items.map((item) => ({
      ...item,
      claims: item.claims.map(normaliseClaim),
    })),
  }
}

// ─── Generate ─────────────────────────────────────────────────────────────────

export interface GenerateTripGuideParams {
  trip: TripGuideInput
  facts: DestinationFacts
  priority?: AICallPriority
}

/**
 * Generate one topic. Returns the validated Topic, or null when the model
 * legitimately produced no relevant items for this topic.
 *
 * Throws only on a PROVIDER failure (so the caller can stop and let the
 * cooldown protect the provider). Content failures (schema mismatch / bad
 * JSON) are swallowed here — they return null and are logged — because they are
 * not the provider's fault and must not trip the global cooldown.
 */
async function generateTopic(
  trip: TripGuideInput,
  facts: DestinationFacts,
  topicId: string,
  questions: QuestionDef[]
): Promise<Topic | null> {
  const prompt = buildTopicPrompt(trip, facts, topicId, questions)

  recordAICall()

  try {
    const { object } = await generateObject({
      model: getModel(),
      prompt,
      schema: TopicResponseSchema,
      // Ask the provider for JSON directly; more forgiving than tool-mode for
      // these medium-sized objects on smaller models.
      mode: 'json',
      maxTokens: TOPIC_MAX_OUTPUT_TOKENS,
      abortSignal: AbortSignal.timeout(GUIDE_TIMEOUT_MS),
    })

    return normaliseTopic(topicId, object)
  } catch (error: unknown) {
    if (isProviderFailure(error)) {
      // Real provider/transport problem — record it (triggers cooldown) and
      // propagate so the caller stops hitting a failing provider.
      recordAIFailure()
      throw error
    }
    // Content failure (schema mismatch / unparseable JSON): NOT a provider
    // problem, so do NOT record a failure / trip the cooldown. Skip this topic.
    console.warn(
      `[trip-guide-generator] Topic "${topicId}" produced no valid object (content failure) — skipping:`,
      error instanceof Error ? error.message : error
    )
    return null
  }
}

/**
 * Generate a validated, personalised TripGuide by generating each relevant
 * topic separately and assembling them.
 *
 * Partial success: as long as at least one topic is produced, a valid guide is
 * returned with the topics that succeeded. Throws AIRateLimitedError when the
 * limiter refuses the call, and AdviceTimeoutError only when NO topic could be
 * produced at all.
 */
export async function generateTripGuide(params: GenerateTripGuideParams): Promise<TripGuide> {
  const { trip, facts, priority = 'high' } = params

  const questions = selectRelevantQuestions(facts, trip)
  const topicGroups = groupByTopic(questions)

  if (!canCallAI(priority)) {
    const status = getRateLimitStatus()
    console.log(
      `[trip-guide-generator] Rate limited (minute: ${status.minuteCount}/${status.maxPerMinute}, day: ${status.dayCount}/${status.maxPerDay}, cooldown: ${status.inCooldown}). Skipping generation.`
    )
    throw new AIRateLimitedError()
  }

  console.log('[trip-guide-generator] ▶ GUIDE REQUEST:', JSON.stringify({
    model: process.env.AI_MODEL ?? 'gpt-4o-mini',
    destination: trip.destination,
    country: trip.country,
    topics: topicGroups.map((t) => t.topicId),
    questionCount: questions.length,
  }, null, 2))

  const topics: Topic[] = []
  let providerError: unknown = null

  for (const group of topicGroups) {
    try {
      const topic = await generateTopic(trip, facts, group.topicId, group.questions)
      // Only keep topics that actually produced items.
      if (topic && topic.items.length > 0) topics.push(topic)
    } catch (error: unknown) {
      // Provider failure: stop early — the cooldown is now active and further
      // calls would just be refused. Keep whatever topics already succeeded.
      providerError = error
      console.error('[trip-guide-generator] Provider failure — stopping topic generation:', error)
      break
    }
  }

  if (topics.length === 0) {
    // Nothing usable. Surface a timeout-style error for the caller to handle.
    if (providerError instanceof AIRateLimitedError) throw providerError
    throw new AdviceTimeoutError(
      providerError instanceof Error
        ? `Trip guide generation failed: ${providerError.message}`
        : 'Trip guide generation produced no usable topics'
    )
  }

  const guide: TripGuide = {
    tripSummary: {
      destination: trip.destination,
      country: trip.country,
      nights: trip.nights,
      travellerType: trip.travellerType,
      travelStyles: trip.travelStyles,
    },
    topics,
  }

  const validated = TripGuideSchema.parse(guide)

  console.log('[trip-guide-generator] ◀ GUIDE RESULT:', JSON.stringify({
    topics: validated.topics.length,
    items: validated.topics.reduce((n, t) => n + t.items.length, 0),
    partial: topics.length < topicGroups.length,
  }, null, 2))

  return validated
}

export const TripGuideGenerator = { generateTripGuide, selectRelevantQuestions }

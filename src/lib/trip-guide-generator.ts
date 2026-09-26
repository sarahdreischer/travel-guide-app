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

/**
 * The distinct topic ids relevant to this trip (first-seen order). This is the
 * "expected" topic set used to compute completeness and to decide which topics
 * on-view reconciliation should retry.
 */
export function relevantTopicIds(
  facts: DestinationFacts,
  trip: Pick<TripGuideInput, 'transportMode'>
): string[] {
  const seen = new Set<string>()
  const ids: string[] = []
  for (const q of selectRelevantQuestions(facts, trip)) {
    if (!seen.has(q.topicId)) {
      seen.add(q.topicId)
      ids.push(q.topicId)
    }
  }
  return ids
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

BE CONCRETE — GIVE THE ACTUAL CONTENT, NOT META-ADVICE (most important quality rule)
- The "answer" field must contain the actual, usable content — real examples, phrases, names, numbers — NOT advice telling the traveller to go find or learn that content.
- NEVER write "learn basic greetings", "try the local cuisine", "be aware of customs", "familiarise yourself with…", "research…". Instead, PROVIDE the greetings, name the dishes, state the custom.
- When the destination language is not English, give phrases in the local language WITH a pronunciation hint and the English meaning.
- Worked example — topic "culture", question about greetings, destination in a Greek-speaking area:
  - BAD (generic, rejected): "Learn basic Greek greetings and be aware of cultural taboos to foster positive interactions."
  - GOOD (concrete): answer = "Greetings you'll use daily: 'Καλημέρα' (kah-lee-MEH-rah) = good morning; 'Γεια σας' (YAH-sas) = hello (polite/plural); 'Γεια σου' (YAH-soo) = hi (informal); 'Ευχαριστώ' (ef-kha-ri-STOH) = thank you; 'Παρακαλώ' (pa-ra-ka-LOH) = please/you're welcome. A taboo worth knowing: [state the actual custom]."
- Give at least 2–4 concrete examples wherever the question invites examples (greetings, dishes, phrases, neighbourhoods, apps). One vague sentence is not enough.

RECOMMENDATIONS vs CLAIMS
- Put judgement/decisions in "recommendation" and trip-specific reasoning in "why". Put the concrete factual content (phrases, names, examples, figures) in "answer".
- Every externally verifiable factual statement goes in "claims[]" as an ATOMIC claim. Do not hide factual assertions inside recommendations.
- The "do not fabricate" rule targets VOLATILE or HIGH-RISK specifics (current prices, opening hours, availability, visa/health/legal/safety details) — mark those needs_verification or omit them. It does NOT mean avoiding well-known STABLE facts: standard greeting phrases, common local dish names, the language(s) spoken, major neighbourhoods and broad customs are stable and SHOULD be stated directly (as low-risk stable_fact claims). Providing a common greeting is not fabrication; refusing to and saying "learn some greetings" is the failure mode to avoid.
- If you genuinely cannot establish something: omit it, or give a cautious recommendation without asserting an unsupported fact, or include the claim marked as requiring verification. Never turn uncertainty into certainty.

CLAIMS — each claim has: claim, type, risk, volatility, verificationRequired, requiresAuthoritativeSource, verificationStatus.
- type ∈ stable_fact, current_fact, price, named_entity, transport, opening_hours, weather, health, visa, legal, safety, connectivity, geography, other.
- HIGH RISK (risk="high", verificationRequired=true, requiresAuthoritativeSource=true): visa/entry/immigration, health, vaccination, medication, legal/driving-licence requirements, safety, travel restrictions. Never present uncertain high-risk info as established fact.
- VOLATILE (volatility="volatile", verificationRequired=true): prices, availability, opening hours, transport fares, SIM/eSIM prices, current restrictions/entry/health guidance.
- Seasonal weather: type="weather", volatility="seasonal", verificationRequired=true. Distinguish seasonal expectation from an actual forecast (you don't have a forecast).
- verificationStatus: "needs_verification" when verificationRequired is true, otherwise "not_checked".

ENTITIES — any named hotel/hostel/holiday_rental/restaurant/bar/attraction/tour_operator/transport_provider/neighbourhood/beach/other you mention goes in "entities[]". Do NOT invent named entities. Factual assertions about a named entity (location, status, price) must also appear as claims requiring verification. Respect any maxRecommendations. Present options as "good fit"/"worth considering", not an objective ranking or a universal "best".

PRICES & BUDGET — don't invent precise prices; if a range is useful, mark it volatile + needs_verification. Use the traveller's ACTUAL budget and reason about trade-offs (accommodation/food/transport/activities/buffer); do not just divide total by nights and repeat it.

STYLE — concise, specific, practical, decision-oriented. Every answer must be recognisably about THIS destination: if a sentence could appear unchanged in a guide to any other place, rewrite it with concrete local specifics. Ban meta-advice verbs ("learn", "research", "familiarise yourself with", "be aware of", "explore") in favour of stating the thing itself. Avoid marketing language, filler, and repeated destination descriptions. Do not repeat the same information across items.

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
  /**
   * Restrict generation to this subset of relevant topic ids. Used by on-view
   * reconciliation to retry only the topics that previously failed. When
   * omitted, all relevant topics are generated.
   */
  topicIds?: string[]
}

/**
 * The outcome of attempting to generate a single topic:
 *  - 'produced'  — a valid topic WITH at least one item.
 *  - 'empty'     — the model validly returned zero items (intentional omission
 *                  — this topic is not relevant to the trip). NOT a failure.
 *  - 'failed'    — a content failure (schema mismatch / unparseable JSON). The
 *                  topic could not be produced and SHOULD be retried later.
 *
 * A PROVIDER failure is not represented here — it throws (so the caller stops
 * and the cooldown protects the provider).
 */
type TopicOutcome =
  | { status: 'produced'; topic: Topic }
  | { status: 'empty' }
  | { status: 'failed' }

/**
 * Generate one topic.
 *
 * Throws only on a PROVIDER failure (so the caller can stop and let the
 * cooldown protect the provider). Content failures (schema mismatch / bad JSON)
 * return { status: 'failed' } and are logged — they are not the provider's
 * fault and must not trip the global cooldown, but they ARE retryable.
 */
async function generateTopic(
  trip: TripGuideInput,
  facts: DestinationFacts,
  topicId: string,
  questions: QuestionDef[]
): Promise<TopicOutcome> {
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

    const topic = normaliseTopic(topicId, object)
    // Zero items = the model deliberately found nothing relevant for this trip.
    // That's a valid, complete outcome — not something to retry.
    if (topic.items.length === 0) return { status: 'empty' }
    return { status: 'produced', topic }
  } catch (error: unknown) {
    if (isProviderFailure(error)) {
      // Real provider/transport problem — record it (triggers cooldown) and
      // propagate so the caller stops hitting a failing provider.
      recordAIFailure()
      throw error
    }
    // Content failure (schema mismatch / unparseable JSON): NOT a provider
    // problem, so do NOT record a failure / trip the cooldown. Retryable later.
    console.warn(
      `[trip-guide-generator] Topic "${topicId}" produced no valid object (content failure) — will retry later:`,
      error instanceof Error ? error.message : error
    )
    return { status: 'failed' }
  }
}

/**
 * Metadata describing which topics were attempted and how each fared. Used by
 * the caller to compute completeness and to reconcile (retry) only the topics
 * that actually failed — never the ones the model intentionally left empty.
 */
export interface GuideGenerationMeta {
  /** Every topic id that was attempted in this run. */
  attemptedTopicIds: string[]
  /** Topics that produced items. */
  producedTopicIds: string[]
  /** Topics the model validly returned empty (intentional omission). */
  emptyTopicIds: string[]
  /** Topics that content-failed and should be retried. */
  failedTopicIds: string[]
  /**
   * Terminal, non-retryable topics: produced ∪ empty. Reconciliation retries
   * (relevant − resolved), so a topic the model intentionally left empty is
   * never retried.
   */
  resolvedTopicIds: string[]
  /**
   * True when a provider failure short-circuited the run before every planned
   * topic was attempted (those un-attempted topics are effectively "failed"
   * for reconciliation purposes).
   */
  providerShortCircuited: boolean
  /**
   * True when every planned topic reached a terminal, non-retryable state
   * (produced or intentionally empty) with no failures and no short-circuit.
   */
  complete: boolean
}

export interface GenerateTripGuideResult {
  guide: TripGuide
  meta: GuideGenerationMeta
}

/**
 * Generate a validated, personalised TripGuide by generating each relevant
 * topic separately and assembling them.
 *
 * Partial success: as long as at least one topic is produced, a valid guide is
 * returned (with generation metadata). Throws AIRateLimitedError when the
 * limiter refuses the call, and AdviceTimeoutError only when NO topic could be
 * produced at all.
 *
 * `params.topicIds` restricts generation to a subset of the relevant topics —
 * used by on-view reconciliation to retry only the topics that previously
 * failed, rather than regenerating the whole guide.
 */
export async function generateTripGuide(params: GenerateTripGuideParams): Promise<GenerateTripGuideResult> {
  const { trip, facts, priority = 'high', topicIds } = params

  const questions = selectRelevantQuestions(facts, trip)
  let topicGroups = groupByTopic(questions)

  // Optional subset filter (reconciliation): only (re)generate these topics.
  if (topicIds && topicIds.length > 0) {
    const wanted = new Set(topicIds)
    topicGroups = topicGroups.filter((g) => wanted.has(g.topicId))
  }

  const plannedTopicIds = topicGroups.map((g) => g.topicId)

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
    topics: plannedTopicIds,
    questionCount: questions.length,
    subset: Boolean(topicIds && topicIds.length > 0),
  }, null, 2))

  const topics: Topic[] = []
  const producedTopicIds: string[] = []
  const emptyTopicIds: string[] = []
  const failedTopicIds: string[] = []
  const attemptedTopicIds: string[] = []
  let providerError: unknown = null
  let providerShortCircuited = false

  for (const group of topicGroups) {
    attemptedTopicIds.push(group.topicId)
    try {
      const outcome = await generateTopic(trip, facts, group.topicId, group.questions)
      if (outcome.status === 'produced') {
        topics.push(outcome.topic)
        producedTopicIds.push(group.topicId)
      } else if (outcome.status === 'empty') {
        emptyTopicIds.push(group.topicId)
      } else {
        failedTopicIds.push(group.topicId)
      }
    } catch (error: unknown) {
      // Provider failure: stop early — the cooldown is now active and further
      // calls would just be refused. Keep whatever topics already succeeded;
      // this attempt and any un-attempted planned topics count as failed.
      providerError = error
      providerShortCircuited = true
      failedTopicIds.push(group.topicId)
      console.error('[trip-guide-generator] Provider failure — stopping topic generation:', error)
      break
    }
  }

  // Planned topics never reached (because we broke early) are treated as failed
  // so reconciliation retries them.
  if (providerShortCircuited) {
    for (const g of topicGroups) {
      if (!attemptedTopicIds.includes(g.topicId)) failedTopicIds.push(g.topicId)
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

  const meta: GuideGenerationMeta = {
    attemptedTopicIds,
    producedTopicIds,
    emptyTopicIds,
    failedTopicIds,
    resolvedTopicIds: [...producedTopicIds, ...emptyTopicIds],
    providerShortCircuited,
    complete: failedTopicIds.length === 0 && !providerShortCircuited,
  }

  console.log('[trip-guide-generator] ◀ GUIDE RESULT:', JSON.stringify({
    topics: validated.topics.length,
    items: validated.topics.reduce((n, t) => n + t.items.length, 0),
    produced: meta.producedTopicIds.length,
    empty: meta.emptyTopicIds.length,
    failed: meta.failedTopicIds.length,
    complete: meta.complete,
  }, null, 2))

  return { guide: validated, meta }
}

export const TripGuideGenerator = { generateTripGuide, selectRelevantQuestions }

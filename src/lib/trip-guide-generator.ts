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
 * Every externally verifiable statement is extracted into `claims[]` and
 * flagged for the FUTURE verification pipeline (not verified here). Claims are
 * defensively normalised so risk/verification invariants always hold.
 *
 * Reuses the existing AI SDK setup (generateObject + @ai-sdk/openai) and the
 * shared rate limiter.
 */

import { generateObject } from 'ai'
import { openai } from '@ai-sdk/openai'
import {
  TripGuideSchema,
  normaliseClaim,
  type TripGuide,
} from '@/lib/schemas/trip-guide'
import type { DestinationFacts } from '@/lib/schemas/destination-facts'
import { QUESTION_LIBRARY, type QuestionDef } from '@/lib/question-library'
import { canCallAI, recordAICall, recordAIFailure, getRateLimitStatus } from '@/lib/ai-rate-limiter'
import type { AICallPriority } from '@/lib/ai-rate-limiter'
import { AIRateLimitedError, AdviceTimeoutError } from '@/lib/llm-adapter'

// ─── Config ─────────────────────────────────────────────────────────────────

function getModel() {
  const modelId = process.env.AI_MODEL ?? 'gpt-4o-mini'
  return openai(modelId)
}

const GUIDE_TIMEOUT_MS = parseInt(process.env.AI_GUIDE_TIMEOUT_MS ?? '90000', 10)
const GUIDE_MAX_OUTPUT_TOKENS = parseInt(process.env.AI_GUIDE_MAX_OUTPUT_TOKENS ?? '8192', 10)

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

// ─── Prompt ─────────────────────────────────────────────────────────────────

function describeBudget(trip: TripGuideInput): string {
  if (!trip.totalBudgetUsd) return 'Budget: not specified.'
  const incl = trip.transportCostIncluded
    ? ' (this total INCLUDES getting there — estimate and subtract travel costs before daily spend)'
    : ' (this total EXCLUDES getting there — it is destination spending money)'
  return `Total budget: $${trip.totalBudgetUsd.toLocaleString()} USD for ${trip.nights} night(s)${incl}.`
}

function buildGuidePrompt(
  trip: TripGuideInput,
  facts: DestinationFacts,
  questions: QuestionDef[]
): string {
  const factsBlock = JSON.stringify(
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

  const questionBlock = questions
    .map(
      (q) =>
        `- ${q.id} [topic=${q.topicId}, answerType=${q.answerType}, risk=${q.risk}, volatility=${q.volatility}]: ${q.question}`
    )
    .join('\n')

  const stylesLine = trip.travelStyles.length ? trip.travelStyles.join(', ') : 'unspecified'
  const activitiesLine = trip.activities?.length ? trip.activities.join(', ') : 'none specified'

  return `You are generating a STRUCTURED, personalised travel guide for ONE traveller's specific trip. You are given (1) the trip, (2) researched DESTINATION FACTS you must treat as baseline truth, and (3) a set of relevant questions. Produce structured JSON ONLY, matching the schema.

TRIP:
- Destination: ${trip.destination}, ${trip.country}
- Nights: ${trip.nights}
- Traveller type: ${trip.travellerType}
- Travel styles: ${stylesLine}
- Arrival / primary transport: ${trip.transportMode ?? 'unspecified'}
- Starting location: ${trip.startingLocation ?? 'unspecified'}
- Planned activities: ${activitiesLine}
- ${describeBudget(trip)}

DESTINATION FACTS (baseline — do NOT contradict these; use them as factual context):
${factsBlock}

RELEVANT QUESTIONS (use the stable IDs verbatim as questionId; only include the ones that genuinely matter for THIS trip):
${questionBlock}

RULES:
1. Personalise everything to this traveller (party type, styles, budget, nights, month/season, starting location, activities). Never write generic content that could appear unchanged in a guidebook about the destination.
2. Do NOT contradict the DESTINATION FACTS. If a fact is unknown (null), do not assert it exists or doesn't.
3. EXCLUDE irrelevant questions — omit any GuideItem that doesn't matter for this trip. Prefer FEWER, STRONGER items over answering everything. It is correct to leave whole topics out.
4. Distinguish RECOMMENDATIONS (your opinionated advice) from factual CLAIMS. Put opinion in "recommendation"/"why"; put every externally verifiable factual statement into "claims[]".
5. Do NOT invent businesses, prices, opening hours, or transport systems. If you name a place, add it to "entities[]" with the right entityType. If unsure of a current price, describe the range and mark the claim volatile.
6. claims[]: each externally verifiable statement is a separate claim. Set:
   - type: one of stable_fact, current_fact, price, named_entity, transport, opening_hours, weather, health, visa, legal, safety, connectivity, geography, other.
   - HIGH RISK (risk="high", verificationRequired=true, requiresAuthoritativeSource=true) for: visa/entry, health, vaccination, medication, legal/licence requirements, safety, current restrictions.
   - VOLATILE (verificationRequired=true) for: prices, opening hours, availability, current transport info, weather.
   - verificationStatus: "needs_verification" when verificationRequired, else "not_checked".
7. entities[]: real named places/providers you mention (hotels, restaurants, neighbourhoods, beaches, tour/transport providers, etc.).
8. actions[]: concrete next steps the traveller can take (e.g. "Book airport transfer in advance").
9. Use the ACTUAL trip budget in cost-related items. Keep advice mutually consistent — never contradict yourself across topics.
10. Do NOT include citations or URLs anywhere in the output.

OUTPUT SHAPE:
- tripSummary: { destination, country, nights, travellerType, travelStyles }
- topics[]: each { topicId, summary: { headline, recommendation }, items[] }
- items[] (GuideItem): { questionId, priority (high|medium|low), applicability, recommendation|null, why|null, answer|null, entities[], claims[], actions[] }
Group items under the topicId given for each question. Only include topics that have at least one item.`
}

// ─── Post-processing ───────────────────────────────────────────────────────

/**
 * Defensively normalise the generated guide so schema/risk invariants always
 * hold regardless of model output (e.g. force health/safety claims to
 * high-risk + verification-required), and align tripSummary with known inputs.
 */
function normaliseGuide(guide: TripGuide, trip: TripGuideInput): TripGuide {
  return {
    tripSummary: {
      destination: trip.destination,
      country: trip.country,
      nights: trip.nights,
      travellerType: trip.travellerType,
      travelStyles: trip.travelStyles,
    },
    topics: guide.topics.map((topic) => ({
      ...topic,
      items: topic.items.map((item) => ({
        ...item,
        claims: item.claims.map(normaliseClaim),
      })),
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
 * Generate a validated, personalised TripGuide. Throws AIRateLimitedError /
 * AdviceTimeoutError on failure.
 */
export async function generateTripGuide(params: GenerateTripGuideParams): Promise<TripGuide> {
  const { trip, facts, priority = 'high' } = params

  const questions = selectRelevantQuestions(facts, trip)

  if (!canCallAI(priority)) {
    const status = getRateLimitStatus()
    console.log(
      `[trip-guide-generator] Rate limited (minute: ${status.minuteCount}/${status.maxPerMinute}, day: ${status.dayCount}/${status.maxPerDay}, cooldown: ${status.inCooldown}). Skipping generation.`
    )
    throw new AIRateLimitedError()
  }

  const prompt = buildGuidePrompt(trip, facts, questions)

  try {
    recordAICall()

    console.log('[trip-guide-generator] ▶ GUIDE REQUEST:', JSON.stringify({
      model: process.env.AI_MODEL ?? 'gpt-4o-mini',
      destination: trip.destination,
      country: trip.country,
      questionCount: questions.length,
      promptLength: prompt.length,
    }, null, 2))

    const { object: rawGuide } = await generateObject({
      model: getModel(),
      prompt,
      schema: TripGuideSchema,
      maxTokens: GUIDE_MAX_OUTPUT_TOKENS,
      abortSignal: AbortSignal.timeout(GUIDE_TIMEOUT_MS),
    })

    const guide = normaliseGuide(rawGuide, trip)

    // Final validation of the normalised guide.
    const validated = TripGuideSchema.parse(guide)

    console.log('[trip-guide-generator] ◀ GUIDE RESULT:', JSON.stringify({
      topics: validated.topics.length,
      items: validated.topics.reduce((n, t) => n + t.items.length, 0),
    }, null, 2))

    return validated
  } catch (error: unknown) {
    recordAIFailure()
    if (error instanceof AIRateLimitedError) throw error
    console.error('[trip-guide-generator] Generation failed:', error)
    if (error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError')) {
      throw new AdviceTimeoutError('Trip guide generation timed out')
    }
    throw new AdviceTimeoutError(
      error instanceof Error ? error.message : 'Trip guide generation failed'
    )
  }
}

export const TripGuideGenerator = { generateTripGuide, selectRelevantQuestions }

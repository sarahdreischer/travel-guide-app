// LLM_Adapter — Requirements 4.1, 4.4, 4.5, 4.7, 4.8, 5.4
import { generateText, generateObject } from 'ai'
import { openai } from '@ai-sdk/openai'
import { z } from 'zod'
import { AdviceStore } from '@/lib/advice-store'
import type { CacheKey, AdviceRecord } from '@/lib/advice-store'
import { canCallAI, recordAICall, recordAIFailure, getRateLimitStatus } from '@/lib/ai-rate-limiter'
import type { AICallPriority } from '@/lib/ai-rate-limiter'

// ─── Custom Errors ────────────────────────────────────────────────────────────

export class AdviceTimeoutError extends Error {
  constructor(message = 'AI advice generation timed out or failed') {
    super(message)
    this.name = 'AdviceTimeoutError'
  }
}

export class AIRateLimitedError extends Error {
  constructor(message = 'AI calls are rate limited — try again later') {
    super(message)
    this.name = 'AIRateLimitedError'
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type { CacheKey } from '@/lib/advice-store'

export type CategoryQuestions = {
  category: string
  subQuestions: string[]
}

// ─── Configuration ────────────────────────────────────────────────────────────

/**
 * Maximum characters per answer. The LLM is instructed to keep each answer
 * within this limit. Change this single value to adjust answer length globally.
 */
const MAX_ANSWER_CHARS = parseInt(process.env.AI_MAX_ANSWER_CHARS ?? '320', 10)

/**
 * Maximum characters per group tip answer. Separate from category answers
 * because group tips are displayed as one-liners in the collapsed accordion row.
 */
const MAX_GROUP_TIP_CHARS = parseInt(process.env.AI_MAX_GROUP_TIP_CHARS ?? '200', 10)

/**
 * How many categories to request per AI call. Requesting all ~20 categories in
 * one call can overflow the model's output token budget and yield an empty
 * response. Chunking keeps each response small and reliable while preserving
 * coherence: categories are chunked in group order, and each chunk is told
 * about the decisions made in earlier chunks.
 */
const CATEGORIES_PER_CHUNK = Math.max(1, parseInt(process.env.AI_CATEGORIES_PER_CHUNK ?? '4', 10))

/**
 * Upper bound on output tokens per AI call. Sized so a chunk of category
 * answers comfortably fits without truncation.
 */
const MAX_OUTPUT_TOKENS = parseInt(process.env.AI_MAX_OUTPUT_TOKENS ?? '4096', 10)

// ─── In-flight request deduplication ──────────────────────────────────────────

const inFlightBatchRequests = new Map<string, Promise<AdviceRecord[]>>()

function buildBatchKey(cacheKey: CacheKey): string {
  return `${cacheKey.destination}|${cacheKey.startMonth}|${cacheKey.endMonth}|${cacheKey.travellerType}|${cacheKey.budgetRange}`
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getModel() {
  const modelId = process.env.AI_MODEL ?? 'gpt-4o-mini'
  return openai(modelId)
}

function describeBudgetRange(tier: string): string {
  switch (tier) {
    case 'budget': return 'budget (under $100/day)'
    case 'mid': return 'mid-range ($100–$499/day)'
    case 'luxury': return 'luxury ($500+/day)'
    default: return tier
  }
}

/**
 * Short natural-language description of the party type so the model can tailor
 * advice (group size, safety framing, pacing, cost-splitting, etc.).
 */
function describeTravellerContext(travellerType: string): string {
  switch (travellerType.toLowerCase()) {
    case 'solo': return 'travelling alone — prioritise solo safety, social/meet-people spots, and single-occupancy value'
    case 'couple': return 'travelling as a couple — favour romantic spots, tables/rooms for two, and shared-cost value'
    case 'friends': return 'travelling as a group of friends — favour group-friendly bookings, nightlife/social options, and splitting costs'
    case 'family': return 'travelling as a family — prioritise kid-friendly, safe, and convenient options with family sizing'
    default: return ''
  }
}

function buildBatchPrompt(
  cacheKey: CacheKey,
  categories: CategoryQuestions[],
  priorAdvice?: Record<string, Record<string, string>>
): string {
  const categoryBlocks = categories
    .map((cat) => {
      const questions = cat.subQuestions.map((q, i) => `  ${i + 1}. ${q}`).join('\n')
      return `### ${cat.category}\n${questions}`
    })
    .join('\n\n')

  const transportLine = cacheKey.transportMode
    ? `\n- Primary Transport Mode: ${cacheKey.transportMode}`
    : ''

  const startingLine = cacheKey.startingLocation
    ? `\n- Travelling From: ${cacheKey.startingLocation}`
    : ''

  // Build budget context line with daily budget estimation
  let budgetLine = `\n- Budget Range: ${describeBudgetRange(cacheKey.budgetRange)}`
  if (cacheKey.totalBudgetUsd && cacheKey.tripDurationDays) {
    const totalBudget = cacheKey.totalBudgetUsd
    const days = cacheKey.tripDurationDays
    const transportNote = cacheKey.transportCostIncluded
      ? ' (transportation costs ARE included in this total — estimate and subtract travel costs before calculating daily spending)'
      : ' (transportation costs are NOT included — this is purely destination spending money)'
    budgetLine = `\n- Total Budget: $${totalBudget.toLocaleString()} USD for ${days} days${transportNote}`
  }

  const activitiesLine = cacheKey.activities && cacheKey.activities.length > 0
    ? `\n- Planned Activities: ${cacheKey.activities.join(', ')}`
    : '\n- Planned Activities: None specified (no particular activity preferences)'

  const travelStyleLine = cacheKey.travelStyle
    ? `\n- Travel Style: ${cacheKey.travelStyle}`
    : ''

  const travellerContext = describeTravellerContext(cacheKey.travellerType)

  const nights = cacheKey.tripDurationDays ?? null
  const durationLine = nights ? `\n- Trip Length: ${nights} night${nights !== 1 ? 's' : ''}` : ''

  // A one-line human summary the model can reference directly in its answers.
  const tripSummary = [
    nights ? `${nights}-night` : null,
    cacheKey.travellerType,
    'trip to',
    cacheKey.destination,
    cacheKey.travelStyle ? `(style: ${cacheKey.travelStyle})` : null,
    cacheKey.totalBudgetUsd ? `on a $${cacheKey.totalBudgetUsd.toLocaleString()} budget` : null,
  ].filter(Boolean).join(' ')

  // When earlier chunks have already been answered, show them so this chunk
  // stays consistent (same recommendations, no contradictions across chunks).
  let priorContext = ''
  if (priorAdvice && Object.keys(priorAdvice).length > 0) {
    const lines: string[] = []
    for (const [category, answers] of Object.entries(priorAdvice)) {
      const items = Object.entries(answers)
        .map(([q, a]) => `    • ${q} → ${a}`)
        .join('\n')
      lines.push(`  [${category}]\n${items}`)
    }
    priorContext = `

DECISIONS ALREADY MADE FOR THIS TRIP (from earlier categories — you MUST stay consistent with these; do not contradict them, and reuse the same named recommendations, prices, and yes/no calls where relevant):
${lines.join('\n')}`
  }

  return `You are a seasoned personal travel advisor writing directly to ONE traveller about THEIR specific trip. You are not writing a guidebook or an encyclopedia entry — you are giving them your opinion and recommendations for their exact situation. Keep each answer to ${MAX_ANSWER_CHARS} characters maximum.

THE TRIP: ${tripSummary}.

CRITICAL RULES — read carefully, they define what a good answer looks like:

1. **The "generic article" test (most important)**: Before finalising each answer, ask: "Could this exact sentence appear, unchanged, in a generic article about ${cacheKey.destination}?" If YES, rewrite it. Every answer must be recognisably about THIS traveller's trip, not the destination in general.

2. **Reason from the traveller's own facts**: Explicitly tie recommendations to their details using natural phrasing such as "Because you're travelling as a ${cacheKey.travellerType}…", "For your ${nights ?? ''}-night trip…", "Since you've chosen ${cacheKey.travelStyle || 'this style'}…", "Given your budget…". Use the party type, travel style, budget, trip length, travel month/season, starting location and planned activities as the *reasons* behind your advice — not just as background.

3. **Take a clear position — be opinionated**: Don't list every option neutrally. Make the decision for them and say why. Use phrasing like "I'd recommend…", "I'd prioritise…", "I wouldn't bother with…", "I'd avoid…", "It's worth it for you because…". When a question implies a yes/no (e.g. "Should I get an eSIM?"), answer it directly and justify it from their trip, rather than defaulting to a generic "yes, get one".

4. **Fewer, stronger recommendations**: The goal is not more information — it's fewer, sharper, actionable calls the traveller can act on. For a ${nights ?? 'short'}-night trip, favour prioritisation ("focus on 1–2 things") over exhaustive lists. Consider pacing, travel/transfer time, and whether an itinerary is realistic for their trip length.

5. **Name concrete specifics**: When recommending what to book, eat, stay in, or use, name real examples — operators, neighbourhoods, dishes, apps, booking platforms, transit passes, SIM/eSIM providers — with typical prices in USD where relevant (1–3 named examples, not a category). If unsure of an exact current name, give the most likely well-known option plus a reliable way to find it.

6. **No filler**: No preambles ("It depends…", "There are many options…"), no restating the question, no hedging padding. Spend the character budget on the recommendation, the reason it applies to them, and specifics.

7. **Coherence & budget**: Answers MUST be consistent across all categories (never contradict yourself). Factor the total budget into ALL cost-related recommendations and align them to a realistic daily spend.

Example — for a 7-night couple's Adventure trip to Costa Rica on a $3,500 budget:
- BAD (generic): "Cards are widely accepted in Costa Rica, but carry some cash for markets and taxis."
- GOOD (trip-specific): "Cards cover most of your accommodation and larger purchases. For your 7 nights I'd carry ₡20,000–30,000 cash for sodas, parking, roadside stops and taxis — enough without over-carrying on a $3,500 budget."
- BAD (neutral): "Staying connected is easy — grab an eSIM and use café/hotel Wi-Fi."
- GOOD (opinionated + reasoned): "I'd get mobile data for this trip. Since you're driving between regions as a couple, you'll want reliable maps and messaging beyond hotel Wi-Fi. An eSIM (e.g. Airalo ~$15–25) is simplest if your phone supports it; download offline maps before remote stretches."

Trip context:
- Destination: ${cacheKey.destination}
- Travel Month(s): ${cacheKey.startMonth === cacheKey.endMonth ? cacheKey.startMonth : `${cacheKey.startMonth} to ${cacheKey.endMonth}`}${durationLine}
- Traveller Type: ${cacheKey.travellerType}${travellerContext ? ` — ${travellerContext}` : ''}${travelStyleLine}${budgetLine}${transportLine}${startingLine}${activitiesLine}
${priorContext}
Answer ALL questions below grouped by category. Return a JSON object where:
- Top-level keys MUST be the EXACT category names as written below (copy them verbatim, including dashes and special characters)
- Each category value is an object mapping the EXACT question text to a concise answer (max ${MAX_ANSWER_CHARS} chars each)

IMPORTANT: Use the category names EXACTLY as they appear in the headings below. Do NOT shorten, rename, or paraphrase them.
IMPORTANT: Every question MUST be nested INSIDE its category object. Do NOT place a question at the top level. The shape is strictly: { "Category Name": { "Question?": "answer", "Another question?": "answer" } }. Never { "Category Name": {...}, "Question?": "answer" }.
IMPORTANT: Ensure all answers are mutually consistent — no contradictions between categories.

${categoryBlocks}`
}

// ─── Core Functions ───────────────────────────────────────────────────────────

/** Normalize a category/question key for tolerant matching. */
function normalizeAnswerKey(s: string): string {
  return s.toLowerCase().replace(/[\u2013\u2014-]/g, '-').replace(/\s+/g, ' ').trim()
}

/**
 * Reshape a raw (and possibly malformed) batch response into the expected
 * `category → { question: answer }` structure.
 *
 * The model occasionally "leaks" a sub-question to the top level as a plain
 * string — e.g. it returns `"What are average hotel prices?": "..."` as a
 * sibling of `"Hotels"` instead of nesting it inside it. When that happens the
 * strict schema would reject the entire response and the chunk would be lost.
 *
 * This function keeps every well-formed category object and re-attaches each
 * leaked top-level string key to the category whose sub-questions include that
 * exact question. Unmatched leaked keys are dropped (they'll be picked up on a
 * later reconciliation pass).
 */
function reshapeBatchAnswers(
  raw: Record<string, Record<string, string> | string>,
  categories: CategoryQuestions[]
): Record<string, Record<string, string>> {
  const shaped: Record<string, Record<string, string>> = {}
  const leaked: Record<string, string> = {}

  // Pass 1: keep proper nested objects; collect leaked string values.
  for (const [key, value] of Object.entries(raw)) {
    if (value && typeof value === 'object') {
      shaped[key] = value as Record<string, string>
    } else if (typeof value === 'string') {
      leaked[key] = value
    }
  }

  if (Object.keys(leaked).length === 0) return shaped

  // Build a lookup from normalized sub-question → category name, so a leaked
  // question can be routed back to the category it belongs to.
  const questionToCategory = new Map<string, string>()
  for (const cat of categories) {
    for (const q of cat.subQuestions) {
      questionToCategory.set(normalizeAnswerKey(q), cat.category)
    }
  }

  // Also match leaked keys against categories we already have a shaped object
  // for, keyed by normalized category name (in case a shaped object exists).
  const shapedByNormalized = new Map<string, string>()
  for (const key of Object.keys(shaped)) {
    shapedByNormalized.set(normalizeAnswerKey(key), key)
  }

  for (const [leakedKey, answer] of Object.entries(leaked)) {
    const targetCategory = questionToCategory.get(normalizeAnswerKey(leakedKey))
    if (!targetCategory) {
      console.warn(`[LLM_Adapter] Dropping leaked top-level key that matches no known sub-question: "${leakedKey}"`)
      continue
    }
    // Find (or create) the shaped object for the target category.
    const existingKey = shapedByNormalized.get(normalizeAnswerKey(targetCategory)) ?? targetCategory
    if (!shaped[existingKey]) {
      shaped[existingKey] = {}
      shapedByNormalized.set(normalizeAnswerKey(existingKey), existingKey)
    }
    // Don't clobber an answer the model already nested correctly.
    if (shaped[existingKey][leakedKey] === undefined) {
      shaped[existingKey][leakedKey] = answer
    }
    console.log(`[LLM_Adapter] Recovered leaked key "${leakedKey}" → category "${existingKey}"`)
  }

  return shaped
}

/**
 * Execute a single AI call that answers all categories at once.
 * This is one conversation, one request, one response.
 */
async function executeBatchAICall(
  cacheKey: CacheKey,
  categories: CategoryQuestions[],
  priorAdvice?: Record<string, Record<string, string>>,
  priority: AICallPriority = 'high'
): Promise<AdviceRecord[]> {
  // Enforce rate limit
  if (!canCallAI(priority)) {
    const status = getRateLimitStatus()
    if (status.inCooldown) {
      console.log(
        `[LLM_Adapter] In cooldown (${status.cooldownRemainingSeconds}s remaining). Skipping batch AI call.`
      )
    } else {
      console.log(
        `[LLM_Adapter] Rate limited (minute: ${status.minuteCount}/${status.maxPerMinute}, day: ${status.dayCount}/${status.maxPerDay}). Skipping batch AI call.`
      )
    }
    throw new AIRateLimitedError()
  }

  const prompt = buildBatchPrompt(cacheKey, categories, priorAdvice)

  try {
    // Record the call (one API request for all categories)
    recordAICall()

    console.log('[LLM_Adapter] ▶ AI REQUEST:', JSON.stringify({
      model: process.env.AI_MODEL ?? 'gpt-4o-mini',
      categories: categories.map((c) => c.category),
      cacheKey,
      promptLength: prompt.length,
      prompt,
    }, null, 2))

    const timeoutMs = parseInt(process.env.AI_BATCH_TIMEOUT_MS ?? '90000', 10)
    // Permissive schema: each top-level value is normally a nested object
    // (category → { question: answer }), but the model sometimes "leaks" a
    // sub-question up to the top level as a plain string (e.g. it emits
    // "What are average hotel prices?": "..." as a sibling of "Hotels" instead
    // of nesting it). Accepting a string here prevents the whole chunk from
    // being discarded by validation; we re-attach leaked keys below.
    const { object: rawBatchAnswers } = await generateObject({
      model: getModel(),
      prompt,
      schema: z.record(
        z.string(),
        z.union([z.record(z.string(), z.string()), z.string()])
      ),
      maxTokens: MAX_OUTPUT_TOKENS,
      abortSignal: AbortSignal.timeout(timeoutMs),
    })

    // Reshape the (possibly malformed) response into the expected
    // category → { question: answer } structure, recovering any leaked
    // top-level string keys by matching them back to the category whose
    // sub-questions they belong to.
    const batchAnswers = reshapeBatchAnswers(rawBatchAnswers, categories)

    console.log('[LLM_Adapter] ◀ AI RESPONSE:', JSON.stringify(batchAnswers, null, 2))

    // An empty (or non-object) response means the model produced nothing usable
    // — typically an output-token overflow. Treat it as a failure so the
    // rate-limiter records it and callers can retry, rather than silently
    // saving nothing.
    if (!batchAnswers || typeof batchAnswers !== 'object' || Object.keys(batchAnswers).length === 0) {
      throw new AdviceTimeoutError(
        `AI returned an empty response for ${categories.length} categor${categories.length === 1 ? 'y' : 'ies'}`
      )
    }

    // Persist each category's answers as separate rows (upsert)
    // AI may return category names with slightly different punctuation (e.g. regular
    // hyphen instead of en-dash), so we do a normalized lookup.
    // Additionally, when only one category is requested, just take whatever the AI returned.
    const records: AdviceRecord[] = []
    const normalizeKey = normalizeAnswerKey
    const responseKeyMap = new Map<string, Record<string, string>>()
    for (const [key, value] of Object.entries(batchAnswers)) {
      responseKeyMap.set(normalizeKey(key), value as Record<string, string>)
    }

    for (const cat of categories) {
      let answers = responseKeyMap.get(normalizeKey(cat.category))

      // Fallback: if single category requested and AI returned a single key, use it regardless of name
      if (!answers && categories.length === 1 && responseKeyMap.size === 1) {
        answers = [...responseKeyMap.values()][0]
      }

      // Fallback: try partial match (AI sometimes shortens names)
      if (!answers) {
        const normalizedCat = normalizeKey(cat.category)
        for (const [key, value] of responseKeyMap.entries()) {
          if (normalizedCat.includes(key) || key.includes(normalizedCat)) {
            answers = value
            break
          }
        }
      }

      if (answers && Object.keys(answers).length > 0) {
        const record = await AdviceStore.save({
          destination: cacheKey.destination,
          startMonth: cacheKey.startMonth,
          endMonth: cacheKey.endMonth,
          travellerType: cacheKey.travellerType,
          budgetRange: cacheKey.budgetRange,
          category: cat.category,
          answers,
        })
        records.push(record)
      } else {
        console.warn(`[LLM_Adapter] No answers found in AI response for category "${cat.category}". Available keys: ${[...responseKeyMap.keys()].join(', ')}`)
      }
    }

    return records
  } catch (error: unknown) {
    recordAIFailure()

    if (error instanceof Error && error.name === 'AbortError') {
      console.error('[LLM_Adapter] Batch advice generation timed out:', {
        destination: cacheKey.destination,
        categories: categories.map((c) => c.category),
      })
    } else {
      console.error('[LLM_Adapter] Batch advice generation failed:', error)
    }
    throw new AdviceTimeoutError()
  }
}

/**
 * Generate advice for multiple categories in a single AI conversation.
 * 
 * Idempotent:
 * 1. Only includes categories not already in the DB cache
 * 2. In-flight dedup — concurrent calls for the same cacheKey piggyback on one promise
 * 3. Upsert on save — no duplicates even with concurrent writes
 *
 * This replaces the per-category generateAdvice approach. One AI call handles
 * all missing categories at once.
 */
async function generateAdviceBatch(
  cacheKey: CacheKey,
  categories: CategoryQuestions[],
  priority: AICallPriority = 'high'
): Promise<AdviceRecord[]> {
  if (categories.length === 0) return []

  // Check in-flight dedup at the batch level
  const batchKey = buildBatchKey(cacheKey)
  const inFlight = inFlightBatchRequests.get(batchKey)
  if (inFlight) {
    return inFlight
  }

  const promise = executeChunkedBatch(cacheKey, categories, priority).finally(() => {
    inFlightBatchRequests.delete(batchKey)
  })

  inFlightBatchRequests.set(batchKey, promise)

  return promise
}

/**
 * Run the batch as a sequence of smaller chunks to avoid overflowing the model's
 * output token budget (which yields an empty response for large requests).
 *
 * Coherence is preserved two ways:
 * 1. Categories arrive already ordered by group, so related categories land in
 *    the same chunk.
 * 2. Each chunk is given the answers from all earlier chunks as "decisions
 *    already made", so later chunks stay consistent (same named picks, prices,
 *    and yes/no calls) instead of contradicting earlier ones.
 *
 * Chunks run sequentially (not in parallel) precisely so this prior-answer
 * context can be threaded forward.
 */
async function executeChunkedBatch(
  cacheKey: CacheKey,
  categories: CategoryQuestions[],
  priority: AICallPriority = 'high'
): Promise<AdviceRecord[]> {
  // Small enough to fit in one call — no need to chunk.
  if (categories.length <= CATEGORIES_PER_CHUNK) {
    return executeBatchAICall(cacheKey, categories, undefined, priority)
  }

  const chunks: CategoryQuestions[][] = []
  for (let i = 0; i < categories.length; i += CATEGORIES_PER_CHUNK) {
    chunks.push(categories.slice(i, i + CATEGORIES_PER_CHUNK))
  }

  console.log(
    `[LLM_Adapter] Chunking ${categories.length} categories into ${chunks.length} calls of up to ${CATEGORIES_PER_CHUNK} (sequential, coherence-threaded).`
  )

  const allRecords: AdviceRecord[] = []
  const priorAdvice: Record<string, Record<string, string>> = {}
  const errors: unknown[] = []

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]
    try {
      const records = await executeBatchAICall(cacheKey, chunk, priorAdvice, priority)
      for (const record of records) {
        allRecords.push(record)
        // Thread this chunk's answers forward so later chunks stay consistent.
        priorAdvice[record.category] = record.answers as Record<string, string>
      }
    } catch (error: unknown) {
      // One chunk failing shouldn't discard the chunks that already succeeded.
      // Collect the error and keep going; surface it only if nothing succeeded.
      console.error(
        `[LLM_Adapter] Chunk ${i + 1}/${chunks.length} failed (categories: ${chunk.map((c) => c.category).join(', ')}):`,
        error
      )
      errors.push(error)
    }
  }

  // If every chunk failed, propagate so callers can retry / show an error.
  if (allRecords.length === 0 && errors.length > 0) {
    throw errors[0]
  }

  return allRecords
}

/**
 * Generate structured advice for a single (cacheKey, category) pair.
 * Kept for backward compatibility — wraps the batch call for a single category.
 */
async function generateAdvice(params: {
  cacheKey: CacheKey
  category: string
  subQuestions: string[]
}): Promise<AdviceRecord> {
  const { cacheKey, category } = params

  // Check DB cache first
  const existing = await AdviceStore.findByCacheKey(cacheKey, category)
  if (existing) {
    return existing
  }

  const records = await generateAdviceBatch(cacheKey, [
    { category: params.category, subQuestions: params.subQuestions },
  ])

  const record = records.find((r) => r.category === category)
  if (record) return record

  // If the AI didn't return this category, throw
  throw new AdviceTimeoutError(`AI did not return advice for category "${category}"`)
}

/**
 * Generate a single-sentence summary of full advice text.
 * Graceful fallback: returns original text on error (Req 5.4).
 */
async function summarise(fullAdvice: string): Promise<string> {
  try {
    const summarisePrompt = `Summarise the following travel briefing into a single concise sentence (max 15 words):\n\n${fullAdvice}`

    console.log('[LLM_Adapter] ▶ AI SUMMARISE REQUEST:', JSON.stringify({
      model: process.env.AI_MODEL ?? 'gpt-4o-mini',
      prompt: summarisePrompt,
    }, null, 2))

    const { text } = await generateText({
      model: getModel(),
      prompt: summarisePrompt,
      abortSignal: AbortSignal.timeout(30_000),
    })

    console.log('[LLM_Adapter] ◀ AI SUMMARISE RESPONSE:', JSON.stringify({ text }, null, 2))

    return text
  } catch (error: unknown) {
    console.error('[LLM_Adapter] Summarise failed:', error)
    return fullAdvice
  }
}

// ─── Group tip generation ─────────────────────────────────────────────────────

export type GroupQuestion = {
  id: string
  name: string
  question: string
}

/**
 * Generate concise key tips for display groups.
 * Uses the same model, rate limits, timeout, and character limit as category advice.
 * Returns a map of groupId → answer string.
 *
 * When `existingAdvice` is provided, the prompt includes a summary of the actual
 * sub-question answers so that group tips are consistent with and derived from
 * the detailed advice already generated.
 */
async function generateGroupTips(
  cacheKey: CacheKey,
  groups: GroupQuestion[],
  existingAdvice?: Record<string, Record<string, string>>,
  priority: AICallPriority = 'high'
): Promise<Record<string, string>> {
  if (groups.length === 0) return {}

  if (!canCallAI(priority)) {
    const status = getRateLimitStatus()
    console.log(`[LLM_Adapter] Rate limited (priority=${priority}) — skipping group tips. cooldown: ${status.inCooldown}`)
    return {}
  }

  const questionList = groups
    .map((g, i) => `${i + 1}. "${g.id}": ${g.question}`)
    .join('\n')

  const transportLine = cacheKey.transportMode
    ? `\n- Primary Transport Mode: ${cacheKey.transportMode}`
    : ''

  const startingLine = cacheKey.startingLocation
    ? `\n- Travelling From: ${cacheKey.startingLocation}`
    : ''

  let budgetLine = `\n- Budget Range: ${describeBudgetRange(cacheKey.budgetRange)}`
  if (cacheKey.totalBudgetUsd && cacheKey.tripDurationDays) {
    const totalBudget = cacheKey.totalBudgetUsd
    const days = cacheKey.tripDurationDays
    const transportNote = cacheKey.transportCostIncluded
      ? ' (transport costs included in total)'
      : ' (transport costs excluded — destination spending only)'
    budgetLine = `\n- Total Budget: $${totalBudget.toLocaleString()} USD for ${days} days${transportNote}`
  }

  const activitiesLine = cacheKey.activities && cacheKey.activities.length > 0
    ? `\n- Planned Activities: ${cacheKey.activities.join(', ')}`
    : '\n- Planned Activities: None specified (no particular activity preferences)'

  const travelStyleLine = cacheKey.travelStyle
    ? `\n- Travel Style: ${cacheKey.travelStyle}`
    : ''

  const travellerContext = describeTravellerContext(cacheKey.travellerType)

  // Build a context block from existing sub-question answers so tips are derived from actual advice
  let adviceContext = ''
  if (existingAdvice && Object.keys(existingAdvice).length > 0) {
    const summaryLines: string[] = []
    for (const [category, answers] of Object.entries(existingAdvice)) {
      const topAnswers = Object.entries(answers).slice(0, 3).map(([q, a]) => `  Q: ${q} → ${a}`).join('\n')
      summaryLines.push(`[${category}]\n${topAnswers}`)
    }
    adviceContext = `\n\n--- EXISTING DETAILED ADVICE (your tips MUST be consistent with these answers) ---\n${summaryLines.join('\n\n')}\n--- END OF EXISTING ADVICE ---\n`
  }

  const nights = cacheKey.tripDurationDays ?? null
  const durationLine = nights ? `\n- Trip Length: ${nights} night${nights !== 1 ? 's' : ''}` : ''

  const prompt = `You are a seasoned personal travel advisor writing a single headline recommendation per group, directly to ONE traveller about THEIR trip. Each tip must be max ${MAX_GROUP_TIP_CHARS} characters.

RULES:
- **Trip-specific, not generic**: Ask "could this sentence appear in a generic article about ${cacheKey.destination}?" — if so, rewrite it. Tie the tip to their trip (party type, ${cacheKey.travelStyle || 'style'}, ${nights ?? ''}-night length, budget, season).
- **Opinionated**: Take a position ("I'd prioritise…", "I'd skip…", "Worth it for you because…"), don't neutrally summarise.
- **Consistency**: Tips MUST reflect and never contradict the detailed advice below.
- **Concrete**: Where it fits, name a real place, provider, dish, or figure rather than generic phrasing.
- **No filler**: Lead with the actionable takeaway; no preambles or padding.
- **Tailored**: This is a ${cacheKey.travellerType} traveller${travellerContext ? ` (${travellerContext})` : ''}${cacheKey.travelStyle ? ` with a ${cacheKey.travelStyle} style` : ''}.

Trip context:
- Destination: ${cacheKey.destination}
- Travel Month(s): ${cacheKey.startMonth === cacheKey.endMonth ? cacheKey.startMonth : `${cacheKey.startMonth} to ${cacheKey.endMonth}`}${durationLine}
- Traveller Type: ${cacheKey.travellerType}${travelStyleLine}${budgetLine}${transportLine}${startingLine}${activitiesLine}${adviceContext}

Answer these questions. Return a JSON object with exactly these keys: ${groups.map((g) => `"${g.id}"`).join(', ')}. Each value is your headline tip as a string (max ${MAX_GROUP_TIP_CHARS} chars).

${questionList}`

  // Build a concrete zod schema with exact keys so the AI knows what to return
  const schemaShape: Record<string, z.ZodString> = {}
  for (const g of groups) {
    schemaShape[g.id] = z.string()
  }
  const schema = z.object(schemaShape)

  try {
    recordAICall()

    console.log('[LLM_Adapter] ▶ AI GROUP TIPS REQUEST:', JSON.stringify({
      model: process.env.AI_MODEL ?? 'gpt-4o-mini',
      groups: groups.map((g) => ({ id: g.id, question: g.question })),
      cacheKey,
      prompt,
    }, null, 2))

    const timeoutMs = parseInt(process.env.AI_BATCH_TIMEOUT_MS ?? '90000', 10)
    const { object: answers } = await generateObject({
      model: getModel(),
      prompt,
      schema,
      abortSignal: AbortSignal.timeout(timeoutMs),
    })

    console.log('[LLM_Adapter] ◀ AI GROUP TIPS RESPONSE:', JSON.stringify(answers, null, 2))

    return answers as Record<string, string>
  } catch (error: unknown) {
    recordAIFailure()
    console.error('[LLM_Adapter] Group tips generation failed:', error)
    return {}
  }
}

// ─── Export ───────────────────────────────────────────────────────────────────

export const LLMAdapter = { generateAdvice, generateAdviceBatch, generateGroupTips, summarise }

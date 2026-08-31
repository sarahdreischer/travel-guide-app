// LLM_Adapter — Requirements 4.1, 4.4, 4.5, 4.7, 4.8, 5.4
import { generateText, generateObject } from 'ai'
import { openai } from '@ai-sdk/openai'
import { z } from 'zod'
import { AdviceStore } from '@/lib/advice-store'
import type { CacheKey, AdviceRecord } from '@/lib/advice-store'
import { canCallAI, recordAICall, recordAIFailure, getRateLimitStatus } from '@/lib/ai-rate-limiter'

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
  categories: CategoryQuestions[]
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

  return `You are an expert local travel advisor. Answer as if you know this destination first-hand and are briefing THIS specific traveller. Keep each answer to ${MAX_ANSWER_CHARS} characters maximum.

CRITICAL RULES:
1. **Tailor to the traveller**: Genuinely understand and address this specific trip. A ${cacheKey.travellerType} traveller ${travellerContext} has different needs than others — reflect that in every relevant answer (safety framing, room/table sizing, pacing, social vs. quiet spots, splitting costs, etc.). Match the advice to their travel style${cacheKey.travelStyle ? ` (${cacheKey.travelStyle})` : ''}, budget, month of travel, and planned activities.
2. **Always name concrete examples**: Whenever a question asks what/where/which to book, eat, stay, use, or visit, you MUST name specific real-world examples — actual business/operator names, neighbourhoods, dish names, apps, booking platforms, transit passes, or SIM/eSIM providers — plus typical prices in USD where relevant. Give 1–3 named examples, not a category. Do NOT answer with generic phrasing like "book in advance for the best spots" or "eat where the locals eat"; instead name the operators, dive shops, restaurants, districts, or platforms a traveller would actually use. If you are not certain of an exact current name, give the most likely well-known option and a reliable way to find it (e.g. a named booking site).
   Example — BAD: "Book freediving and scuba diving trips in advance for the best spots." GOOD: "Book ahead with reputable dive shops — e.g. Rich Coast Diving or Sirenas Diving in Playas del Coco (~$90–120 for 2 tanks). Book via PADI Travel or the shop's own site 1–2 weeks out."
3. **Be concise — no filler**: Every answer must carry useful, actionable information. No preambles ("It depends…", "There are many options…"), no restating the question, no hedging padding. Use the character budget for specifics (names, places, prices), not padding. If a direct yes/no applies, lead with it.
4. **Coherence**: Answers MUST be consistent across all categories — never contradict yourself (e.g. don't advise against renting a car in one place and recommend it in another). Review the full set for consistency before finalising.
5. **Budget-aware**: Factor the total budget into ALL cost-related recommendations. Estimate a realistic daily budget and align accommodation, food, activity, and transport suggestions to it.

Trip context:
- Destination: ${cacheKey.destination}
- Travel Month(s): ${cacheKey.startMonth === cacheKey.endMonth ? cacheKey.startMonth : `${cacheKey.startMonth} to ${cacheKey.endMonth}`}
- Traveller Type: ${cacheKey.travellerType}${travellerContext ? ` — ${travellerContext}` : ''}${travelStyleLine}${budgetLine}${transportLine}${startingLine}${activitiesLine}

Answer ALL questions below grouped by category. Return a JSON object where:
- Top-level keys MUST be the EXACT category names as written below (copy them verbatim, including dashes and special characters)
- Each category value is an object mapping the EXACT question text to a concise answer (max ${MAX_ANSWER_CHARS} chars each)

IMPORTANT: Use the category names EXACTLY as they appear in the headings below. Do NOT shorten, rename, or paraphrase them.
IMPORTANT: Ensure all answers are mutually consistent — no contradictions between categories.

${categoryBlocks}`
}

// ─── Core Functions ───────────────────────────────────────────────────────────

/**
 * Execute a single AI call that answers all categories at once.
 * This is one conversation, one request, one response.
 */
async function executeBatchAICall(
  cacheKey: CacheKey,
  categories: CategoryQuestions[]
): Promise<AdviceRecord[]> {
  // Enforce rate limit
  if (!canCallAI()) {
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

  const prompt = buildBatchPrompt(cacheKey, categories)

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
    const { object: batchAnswers } = await generateObject({
      model: getModel(),
      prompt,
      schema: z.record(z.string(), z.record(z.string(), z.string())),
      abortSignal: AbortSignal.timeout(timeoutMs),
    })

    console.log('[LLM_Adapter] ◀ AI RESPONSE:', JSON.stringify(batchAnswers, null, 2))

    // Persist each category's answers as separate rows (upsert)
    // AI may return category names with slightly different punctuation (e.g. regular
    // hyphen instead of en-dash), so we do a normalized lookup.
    // Additionally, when only one category is requested, just take whatever the AI returned.
    const records: AdviceRecord[] = []
    const normalizeKey = (s: string) => s.toLowerCase().replace(/[\u2013\u2014-]/g, '-').replace(/\s+/g, ' ').trim()
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
  categories: CategoryQuestions[]
): Promise<AdviceRecord[]> {
  if (categories.length === 0) return []

  // Check in-flight dedup at the batch level
  const batchKey = buildBatchKey(cacheKey)
  const inFlight = inFlightBatchRequests.get(batchKey)
  if (inFlight) {
    return inFlight
  }

  const promise = executeBatchAICall(cacheKey, categories).finally(() => {
    inFlightBatchRequests.delete(batchKey)
  })

  inFlightBatchRequests.set(batchKey, promise)

  return promise
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
  existingAdvice?: Record<string, Record<string, string>>
): Promise<Record<string, string>> {
  if (groups.length === 0) return {}

  if (!canCallAI()) {
    const status = getRateLimitStatus()
    console.log(`[LLM_Adapter] Rate limited — skipping group tips. cooldown: ${status.inCooldown}`)
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

  const prompt = `You are an expert local travel advisor. For each group below, write a single headline tip summarising the key insight for THIS traveller from the detailed advice already generated. Each tip must be max ${MAX_GROUP_TIP_CHARS} characters.

RULES:
- **Consistency**: Tips MUST reflect and never contradict the detailed advice below.
- **Concrete & specific**: Where it fits, name a real place, provider, dish, or figure rather than generic phrasing.
- **No filler**: Lead with the actionable takeaway; no preambles or padding.
- **Tailored**: Reflect that this is a ${cacheKey.travellerType} traveller${travellerContext ? ` (${travellerContext})` : ''}${cacheKey.travelStyle ? ` with a ${cacheKey.travelStyle} style` : ''}.

Trip context:
- Destination: ${cacheKey.destination}
- Travel Month(s): ${cacheKey.startMonth === cacheKey.endMonth ? cacheKey.startMonth : `${cacheKey.startMonth} to ${cacheKey.endMonth}`}
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

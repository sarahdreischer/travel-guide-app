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

// ─── In-flight request deduplication ──────────────────────────────────────────

const inFlightBatchRequests = new Map<string, Promise<AdviceRecord[]>>()

function buildBatchKey(cacheKey: CacheKey): string {
  return `${cacheKey.destination}|${cacheKey.month}|${cacheKey.travellerType}|${cacheKey.budgetRange}`
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getModel() {
  const modelId = process.env.AI_MODEL ?? 'gpt-4o-mini'
  return openai(modelId)
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

  return `You are a concise travel advice expert. Give short, practical answers (1–2 sentences max per question). No filler.

Trip context:
- Destination: ${cacheKey.destination}
- Travel Month: ${cacheKey.month}
- Traveller Type: ${cacheKey.travellerType}
- Budget Range: ${cacheKey.budgetRange}

Answer ALL questions below grouped by category. Return a JSON object with category names as top-level keys, each containing an object mapping question text to a concise answer.

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

    const { object: batchAnswers } = await generateObject({
      model: getModel(),
      prompt,
      schema: z.record(z.string(), z.record(z.string(), z.string())),
      abortSignal: AbortSignal.timeout(60_000), // longer timeout for batch
    })

    console.log('[LLM_Adapter] ◀ AI RESPONSE:', JSON.stringify(batchAnswers, null, 2))

    // Persist each category's answers as separate rows (upsert)
    const records: AdviceRecord[] = []
    for (const cat of categories) {
      const answers = batchAnswers[cat.category]
      if (answers && Object.keys(answers).length > 0) {
        const record = await AdviceStore.save({
          destination: cacheKey.destination,
          month: cacheKey.month,
          travellerType: cacheKey.travellerType,
          budgetRange: cacheKey.budgetRange,
          category: cat.category,
          answers,
        })
        records.push(record)
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
    const summarisePrompt = `Summarise the following travel advice into a single concise sentence (max 15 words):\n\n${fullAdvice}`

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

// ─── Export ───────────────────────────────────────────────────────────────────

export const LLMAdapter = { generateAdvice, generateAdviceBatch, summarise }

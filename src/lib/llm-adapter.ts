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

// ─── In-flight request deduplication ──────────────────────────────────────────
//
// Tracks currently in-progress AI calls by a derived key. If a second request
// comes in for the same (cacheKey, category) while the first is still running,
// it awaits the same promise rather than starting a new AI conversation.
// Once the promise settles, the entry is removed so future requests can retry.

const inFlightRequests = new Map<string, Promise<AdviceRecord>>()

function buildRequestKey(cacheKey: CacheKey, category: string): string {
  return `${cacheKey.destination}|${cacheKey.month}|${cacheKey.travellerType}|${cacheKey.budgetRange}|${category}`
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getModel() {
  const modelId = process.env.AI_MODEL ?? 'gpt-4o-mini'
  return openai(modelId)
}

function buildAdvicePrompt(cacheKey: CacheKey, category: string, subQuestions: string[]): string {
  const numberedQuestions = subQuestions
    .map((q, i) => `${i + 1}. ${q}`)
    .join('\n')

  return `You are a travel advice expert. Given the following trip context:
- Destination: ${cacheKey.destination}
- Travel Month: ${cacheKey.month}
- Traveller Type: ${cacheKey.travellerType}
- Budget Range: ${cacheKey.budgetRange}

For the category "${category}", answer each of the following questions:
${numberedQuestions}

Return a JSON object where keys are the question text and values are concise, practical answers.`
}

// ─── Core Functions ───────────────────────────────────────────────────────────

/**
 * The actual AI call — not exported directly. Called only when no in-flight
 * request exists for this key.
 *
 * Enforces rate limiting here (single enforcement point for all AI calls).
 * Records both successful and failed calls against the rate limit window.
 * On failure, activates a cooldown to prevent rapid retries.
 */
async function executeAICall(params: {
  cacheKey: CacheKey
  category: string
  subQuestions: string[]
}): Promise<AdviceRecord> {
  const { cacheKey, category, subQuestions } = params

  // Enforce rate limit — reject before touching the AI provider
  if (!canCallAI()) {
    const status = getRateLimitStatus()
    if (status.inCooldown) {
      console.log(
        `[LLM_Adapter] In cooldown after failure (${status.cooldownRemainingSeconds}s remaining). Skipping AI call for "${category}".`
      )
    } else {
      console.log(
        `[LLM_Adapter] Rate limited (${status.callsUsed}/${status.maxCalls} calls in ${status.windowMinutes}min window). Skipping AI call for "${category}".`
      )
    }
    throw new AIRateLimitedError()
  }

  const prompt = buildAdvicePrompt(cacheKey, category, subQuestions)

  try {
    // Record the call BEFORE making it (counts against window regardless of outcome)
    recordAICall()

    const { object: answers } = await generateObject({
      model: getModel(),
      prompt,
      schema: z.record(z.string(), z.string()),
      abortSignal: AbortSignal.timeout(30_000),
    })

    // Persist the generated advice (upsert — safe for concurrent writes)
    const record = await AdviceStore.save({
      destination: cacheKey.destination,
      month: cacheKey.month,
      travellerType: cacheKey.travellerType,
      budgetRange: cacheKey.budgetRange,
      category,
      answers,
    })

    return record
  } catch (error: unknown) {
    // Record the failure — activates cooldown to prevent hammering
    recordAIFailure()

    if (error instanceof Error && error.name === 'AbortError') {
      console.error('[LLM_Adapter] Advice generation timed out:', {
        destination: cacheKey.destination,
        category,
      })
    } else {
      console.error('[LLM_Adapter] Advice generation failed:', error)
    }
    throw new AdviceTimeoutError()
  }
}

/**
 * Generate structured advice for a (cacheKey, category) pair.
 *
 * Idempotent at three levels:
 * 1. Cache check — returns existing DB record if already generated
 * 2. In-flight dedup — if an AI call for the same key is already running,
 *    piggybacks on that promise instead of starting a new conversation
 * 3. Upsert on save — concurrent writes don't produce duplicates
 *
 * Requirements: 4.1, 4.4, 4.5, 4.7, 4.8
 */
async function generateAdvice(params: {
  cacheKey: CacheKey
  category: string
  subQuestions: string[]
}): Promise<AdviceRecord> {
  const { cacheKey, category } = params

  // Level 1: Check DB cache first
  const existing = await AdviceStore.findByCacheKey(cacheKey, category)
  if (existing) {
    return existing
  }

  // Level 2: Check if there's already an in-flight request for this key
  const requestKey = buildRequestKey(cacheKey, category)
  const inFlight = inFlightRequests.get(requestKey)
  if (inFlight) {
    // Piggyback on the existing AI call instead of starting a new one
    return inFlight
  }

  // Level 3: Start a new AI call and register it in the in-flight map
  const promise = executeAICall(params).finally(() => {
    // Clean up once the call settles (success or failure)
    inFlightRequests.delete(requestKey)
  })

  inFlightRequests.set(requestKey, promise)

  return promise
}

/**
 * Generate a single-sentence summary of full advice text.
 * Graceful fallback: returns original text on error (Req 5.4).
 */
async function summarise(fullAdvice: string): Promise<string> {
  try {
    const { text } = await generateText({
      model: getModel(),
      prompt: `Summarise the following travel advice into a single concise sentence:\n\n${fullAdvice}`,
      abortSignal: AbortSignal.timeout(30_000),
    })

    return text
  } catch (error: unknown) {
    console.error('[LLM_Adapter] Summarise failed:', error)
    return fullAdvice
  }
}

// ─── Export ───────────────────────────────────────────────────────────────────

export const LLMAdapter = { generateAdvice, summarise }

'use server'

// Advice Server Actions — Requirements 4.2, 4.3, 4.4, 4.7, 4.8
import { AdviceStore } from '@/lib/advice-store'
import type { CacheKey, AdviceRecord } from '@/lib/advice-store'
import { LLMAdapter, AdviceTimeoutError, AIRateLimitedError } from '@/lib/llm-adapter'
import { getSubQuestions } from '@/lib/sub-questions'
import { CATEGORIES } from '@/lib/destinations'
import { canCallAI, getRateLimitStatus } from '@/lib/ai-rate-limiter'

// ─── Types ────────────────────────────────────────────────────────────────────

export type CategoryResult =
  | { status: 'success'; record: AdviceRecord }
  | { status: 'error'; category: string; message: string }

export type AdviceActionResult = {
  results: CategoryResult[]
  errors: string[] // Categories that failed
}

export type ReconcileResult = {
  generated: number
  skipped: number
  errors: number
  rateLimited: boolean
}

// ─── Server Action ────────────────────────────────────────────────────────────

/**
 * For each of the 15 categories, attempt to retrieve cached advice or generate
 * new advice via the LLM. Supports partial success — individual category failures
 * do not fail the entire action.
 *
 * Requirements: 4.2, 4.3, 4.4, 4.7, 4.8
 */
export async function getOrGenerateAdviceAction(
  cacheKey: CacheKey
): Promise<AdviceActionResult> {
  const results: CategoryResult[] = []
  const errors: string[] = []

  for (const category of CATEGORIES) {
    try {
      // Step 1: Check cache (Req 4.2, 4.3)
      const cached = await AdviceStore.findByCacheKey(cacheKey, category)

      if (cached) {
        // Cache hit — serve from store without calling AI provider
        results.push({ status: 'success', record: cached })
        continue
      }

      // Step 2: Check rate limit before making LLM call
      if (!canCallAI()) {
        results.push({
          status: 'error',
          category,
          message: 'Rate limited — try again later',
        })
        errors.push(category)
        continue
      }

      // Step 3: Cache miss — generate via LLM (Req 4.4)
      const subQuestions = getSubQuestions(category)
      const record = await LLMAdapter.generateAdvice({
        cacheKey,
        category,
        subQuestions,
      })

      results.push({ status: 'success', record })
    } catch (error: unknown) {
      if (error instanceof AdviceTimeoutError) {
        console.error(
          `[getOrGenerateAdviceAction] Timeout generating advice for category "${category}":`,
          error.message
        )
        results.push({
          status: 'error',
          category,
          message: 'Advice could not be loaded at this time',
        })
        errors.push(category)
      } else {
        console.error(
          `[getOrGenerateAdviceAction] Error for category "${category}":`,
          error
        )
        results.push({
          status: 'error',
          category,
          message: 'Advice could not be saved and will not be cached',
        })
        errors.push(category)
      }
    }
  }

  return { results, errors }
}

/**
 * Reconcile missing advice for a trip on page load.
 * Only generates advice for categories that are missing from the cache.
 * Rate limiting is enforced by the LLM adapter (single enforcement point).
 *
 * Returns how many categories were generated, skipped, or errored.
 */
export async function reconcileMissingAdviceAction(
  cacheKey: CacheKey
): Promise<ReconcileResult> {
  let generated = 0
  let skipped = 0
  let errors = 0
  let rateLimited = false

  // Early exit: if already rate limited, don't even iterate
  if (!canCallAI()) {
    const status = getRateLimitStatus()
    console.log(
      `[reconcileMissingAdvice] Rate limited before starting — ${status.callsUsed}/${status.maxCalls} calls used (cooldown: ${status.inCooldown}). Skipping reconciliation.`
    )
    return { generated: 0, skipped: 0, errors: 0, rateLimited: true }
  }

  for (const category of CATEGORIES) {
    // Check if advice already exists
    const cached = await AdviceStore.findByCacheKey(cacheKey, category)
    if (cached) {
      skipped++
      continue
    }

    // Quick check before each call — stop early if we've hit the limit
    if (!canCallAI()) {
      rateLimited = true
      break
    }

    // Generate the missing advice (rate limit + cooldown enforced inside LLMAdapter)
    try {
      const subQuestions = getSubQuestions(category)
      await LLMAdapter.generateAdvice({
        cacheKey,
        category,
        subQuestions,
      })
      generated++
    } catch (error: unknown) {
      if (error instanceof AIRateLimitedError) {
        rateLimited = true
        break
      }
      console.error(`[reconcileMissingAdvice] Failed for category "${category}":`, error)
      errors++
      // After a failure, the LLM adapter activates cooldown — stop trying more categories
      break
    }
  }

  return { generated, skipped, errors, rateLimited }
}

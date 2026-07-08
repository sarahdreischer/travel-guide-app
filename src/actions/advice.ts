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
 * Collects all missing categories and generates them in a SINGLE AI conversation.
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
      `[reconcileMissingAdvice] Rate limited before starting — minute: ${status.minuteCount}/${status.maxPerMinute}, day: ${status.dayCount}/${status.maxPerDay}, cooldown: ${status.inCooldown}. Skipping reconciliation.`
    )
    return { generated: 0, skipped: 0, errors: 0, rateLimited: true }
  }

  // Collect all missing or stale categories
  const missingCategories: { category: string; subQuestions: string[] }[] = []

  for (const category of CATEGORIES) {
    const cached = await AdviceStore.findByCacheKey(cacheKey, category)
    const subQuestions = getSubQuestions(category)

    if (!cached) {
      // Category not in DB at all
      missingCategories.push({ category, subQuestions })
    } else {
      // Check if the cached record is stale (missing answers for current questions)
      const answers = cached.answers as Record<string, string> | null
      const hasAllQuestions = subQuestions.length === 0 || (
        answers && subQuestions.every((q) => q in answers)
      )

      if (!hasAllQuestions) {
        // Stale record — delete it so it gets regenerated with all current questions
        console.log(
          `[reconcileMissingAdvice] Stale cache for "${category}" — missing answers for new questions. Deleting for regeneration.`
        )
        await AdviceStore.deleteByCacheKey(cacheKey, category)
        missingCategories.push({ category, subQuestions })
      } else {
        skipped++
      }
    }
  }

  if (missingCategories.length === 0) {
    return { generated: 0, skipped, errors: 0, rateLimited: false }
  }

  // Generate ALL missing categories in a single AI conversation
  try {
    const records = await LLMAdapter.generateAdviceBatch(cacheKey, missingCategories)
    generated = records.length
    errors = missingCategories.length - records.length
  } catch (error: unknown) {
    if (error instanceof AIRateLimitedError) {
      rateLimited = true
    } else {
      console.error('[reconcileMissingAdvice] Batch generation failed:', error)
      errors = missingCategories.length
    }
  }

  return { generated, skipped, errors, rateLimited }
}

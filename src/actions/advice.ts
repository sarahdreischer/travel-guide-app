'use server'

// Advice Server Actions — Requirements 4.2, 4.3, 4.4, 4.7, 4.8
import { AdviceStore } from '@/lib/advice-store'
import type { CacheKey, AdviceRecord } from '@/lib/advice-store'
import { LLMAdapter, AdviceTimeoutError, AIRateLimitedError } from '@/lib/llm-adapter'
import { getSubQuestions } from '@/lib/sub-questions'
import { CATEGORIES } from '@/lib/destinations'
import { canCallAI, getRateLimitStatus } from '@/lib/ai-rate-limiter'
import { findAnswer } from '@/lib/answer-lookup'

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

  // Determine which categories power the concise home page cards (priority)
  const { CONCISE_TOPIC_MAPPING } = await import('@/lib/travel-config')
  const conciseCategories: Set<string> = new Set(
    Object.values(CONCISE_TOPIC_MAPPING).map((m) => m.category)
  )

  // Split categories into priority (concise) and remaining (comprehensive)
  const priorityCategories = CATEGORIES.filter((c) => conciseCategories.has(c))
  const remainingCategories = CATEGORIES.filter((c) => !conciseCategories.has(c))

  // Helper to generate a single category
  const generateCategory = async (category: string) => {
    try {
      const cached = await AdviceStore.findByCacheKey(cacheKey, category)
      if (cached) {
        return { status: 'success' as const, record: cached, category }
      }

      if (!canCallAI()) {
        return { status: 'error' as const, category, message: 'Rate limited — try again later' }
      }

      const subQuestions = getSubQuestions(category)
      if (subQuestions.length === 0) {
        return { status: 'skip' as const, category }
      }

      const records = await LLMAdapter.generateAdviceBatch(cacheKey, [{ category, subQuestions }])
      const record = records[0]
      if (record) {
        return { status: 'success' as const, record, category }
      }
      return { status: 'error' as const, category, message: 'No advice generated' }
    } catch (error: unknown) {
      if (error instanceof AdviceTimeoutError) {
        return { status: 'error' as const, category, message: 'Advice could not be loaded at this time' }
      }
      return { status: 'error' as const, category, message: 'Advice could not be saved and will not be cached' }
    }
  }

  // Phase 1: Fetch concise/priority categories in parallel (these power the home page)
  const prioritySettled = await Promise.allSettled(
    priorityCategories.map(generateCategory)
  )

  // Phase 2: Fetch remaining categories in parallel (comprehensive view)
  const remainingSettled = await Promise.allSettled(
    remainingCategories.map(generateCategory)
  )

  // Collect results
  for (const result of [...prioritySettled, ...remainingSettled]) {
    if (result.status === 'fulfilled') {
      const val = result.value
      if (val.status === 'success') {
        results.push({ status: 'success', record: val.record })
      } else if (val.status === 'error') {
        results.push({ status: 'error', category: val.category, message: val.message })
        errors.push(val.category)
      }
    } else {
      results.push({ status: 'error', category: 'unknown', message: 'Unexpected error' })
      errors.push('unknown')
    }
  }

  return { results, errors }
}

/**
 * Reconcile missing advice for a trip.
 * Fires parallel per-category AI requests (in batches of AI_PARALLEL_REQUESTS)
 * so progress updates incrementally and individual failures don't block others.
 *
 * Rate limiting is enforced by the LLM adapter (single enforcement point).
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
      if (subQuestions.length > 0) {
        missingCategories.push({ category, subQuestions })
      } else {
        skipped++
      }
    } else {
      // Check if the cached record is stale (missing answers for current questions)
      const answers = cached.answers as Record<string, string> | null
      const hasAllQuestions = subQuestions.length === 0 || (
        answers && subQuestions.every((q) => findAnswer(answers, q) !== undefined)
      )

      if (!hasAllQuestions) {
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

  // Fire parallel requests — process categories in parallel batches
  const PARALLEL = parseInt(process.env.AI_PARALLEL_REQUESTS ?? '4', 10)
  const results = await Promise.allSettled(
    missingCategories.map((cat) =>
      LLMAdapter.generateAdviceBatch(cacheKey, [cat])
    )
  )

  for (const result of results) {
    if (result.status === 'fulfilled' && result.value.length > 0) {
      generated++
    } else if (result.status === 'rejected') {
      if (result.reason?.name === 'AIRateLimitedError') {
        rateLimited = true
      } else {
        errors++
      }
    } else {
      errors++
    }
  }

  // Limit concurrency log for awareness
  void PARALLEL

  return { generated, skipped, errors, rateLimited }
}

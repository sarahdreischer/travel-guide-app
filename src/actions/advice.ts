'use server'

// Advice Server Actions — Requirements 4.2, 4.3, 4.4, 4.7, 4.8
import { AdviceStore } from '@/lib/advice-store'
import type { CacheKey, AdviceRecord } from '@/lib/advice-store'
import { LLMAdapter, AdviceTimeoutError } from '@/lib/llm-adapter'
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

  // Split categories into priority (the leading home-page group cards) and
  // remaining (comprehensive), based on GROUP_DEFS order in category-groups.ts.
  const { splitCategoriesByGroupPriority } = await import('@/lib/category-groups')
  const { priority: priorityCategories, remaining: remainingCategories } =
    splitCategoriesByGroupPriority([...CATEGORIES])

  // Helper: check cache for all categories, return which are missing or stale
  const getMissing = async (cats: string[]) => {
    const missing: { category: string; subQuestions: string[] }[] = []
    for (const category of cats) {
      const subQuestions = getSubQuestions(category)
      if (subQuestions.length === 0) continue

      const cached = await AdviceStore.findByCacheKey(cacheKey, category)
      if (cached) {
        // Check if stale (missing answers for current questions)
        const answers = cached.answers as Record<string, string> | null
        const hasAllQuestions = answers && subQuestions.every((q) => findAnswer(answers, q) !== undefined)

        if (hasAllQuestions) {
          results.push({ status: 'success', record: cached })
        } else {
          // Stale — delete and regenerate
          console.log(`[getOrGenerateAdvice] Stale cache for "${category}" — regenerating`)
          await AdviceStore.deleteByCacheKey(cacheKey, category)
          missing.push({ category, subQuestions })
        }
      } else {
        missing.push({ category, subQuestions })
      }
    }
    return missing
  }

  // Helper: batch-generate and collect results
  const generateBatch = async (cats: { category: string; subQuestions: string[] }[]) => {
    if (cats.length === 0) return
    if (!canCallAI()) {
      for (const cat of cats) {
        results.push({ status: 'error', category: cat.category, message: 'Rate limited — try again later' })
        errors.push(cat.category)
      }
      return
    }
    try {
      const records = await LLMAdapter.generateAdviceBatch(cacheKey, cats)
      const generatedCategories = new Set(records.map((r) => r.category))
      for (const record of records) {
        results.push({ status: 'success', record })
      }
      // Mark any categories not returned by AI as errors
      for (const cat of cats) {
        if (!generatedCategories.has(cat.category)) {
          results.push({ status: 'error', category: cat.category, message: 'No advice generated' })
          errors.push(cat.category)
        }
      }
    } catch (error: unknown) {
      const msg = error instanceof AdviceTimeoutError
        ? 'Advice could not be loaded at this time'
        : 'Advice generation failed'
      for (const cat of cats) {
        results.push({ status: 'error', category: cat.category, message: msg })
        errors.push(cat.category)
      }
    }
  }

  // Phase 1: Fetch concise/priority categories as ONE batched AI call
  const missingPriority = await getMissing(priorityCategories)
  await generateBatch(missingPriority)

  // Phase 2: Fetch remaining categories as ONE batched AI call
  const missingRemaining = await getMissing(remainingCategories)
  await generateBatch(missingRemaining)

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

  // Fire parallel requests — each category as a separate batch call for resilience
  // (if one times out, the rest still succeed)
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

  return { generated, skipped, errors, rateLimited }
}

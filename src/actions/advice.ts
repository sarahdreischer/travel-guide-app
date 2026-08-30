'use server'

// Advice Server Actions — Requirements 4.2, 4.3, 4.4, 4.7, 4.8
import { AdviceStore } from '@/lib/advice-store'
import type { CacheKey, AdviceRecord } from '@/lib/advice-store'
import { LLMAdapter, AdviceTimeoutError } from '@/lib/llm-adapter'
import { getSubQuestions } from '@/lib/sub-questions'
import { CATEGORIES } from '@/lib/destinations'
import { canCallAI, getRateLimitStatus } from '@/lib/ai-rate-limiter'
import { findAnswer } from '@/lib/answer-lookup'
import { getGroupQuestions } from '@/lib/category-groups'

// Category name used to store the AI-generated group headline tips in advice_cache
const GROUP_TIPS_CATEGORY = '_group_tips'

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
    // Categories are all complete — still make sure group tips are reconciled.
    const groupResult = await reconcileGroupTipsAction(cacheKey)
    return { generated: 0, skipped, errors: 0, rateLimited: groupResult.rateLimited }
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

  // After category advice is reconciled, ensure the group headline tips exist too.
  // (Group tips summarise the sub-question answers, so this runs last.)
  if (!rateLimited) {
    await reconcileGroupTipsAction(cacheKey)
  }

  return { generated, skipped, errors, rateLimited }
}

/**
 * Ensure the AI-generated group headline tips (the one-liner shown on each
 * home-page group card) exist and cover every current group. If the cached
 * `_group_tips` record is missing or stale (missing a tip for any current
 * group), it is regenerated from the latest sub-question answers so the
 * headlines stay consistent with the detailed advice.
 *
 * Safe to call after category reconciliation from the page, the manual
 * reconcile script, and the scheduled reconciler.
 */
export async function reconcileGroupTipsAction(
  cacheKey: CacheKey
): Promise<{ generated: boolean; skipped: boolean; rateLimited: boolean }> {
  const groups = getGroupQuestions()
  const groupIds = groups.map((g) => g.id)

  // Check the cached group tips record for completeness
  const existingRecord = await AdviceStore.findByCacheKey(cacheKey, GROUP_TIPS_CATEGORY)
  if (existingRecord) {
    const tips = existingRecord.answers as Record<string, string> | null
    const hasAllGroups = tips != null && groupIds.every((id) => typeof tips[id] === 'string' && tips[id].length > 0)
    if (hasAllGroups) {
      return { generated: false, skipped: true, rateLimited: false }
    }
    // Stale — delete so it can be regenerated with the full set of groups
    console.log('[reconcileGroupTips] Stale group tips — regenerating')
    await AdviceStore.deleteByCacheKey(cacheKey, GROUP_TIPS_CATEGORY)
  }

  if (!canCallAI()) {
    return { generated: false, skipped: false, rateLimited: true }
  }

  // Build context from existing sub-question answers so tips stay consistent
  // with the detailed advice. (CATEGORIES never includes the group-tips key.)
  const existingAdvice: Record<string, Record<string, string>> = {}
  for (const category of CATEGORIES) {
    const cached = await AdviceStore.findByCacheKey(cacheKey, category)
    const answers = cached?.answers as Record<string, string> | null | undefined
    if (answers && Object.keys(answers).length > 0) {
      existingAdvice[category] = answers
    }
  }

  try {
    const aiTips = await LLMAdapter.generateGroupTips(cacheKey, groups, existingAdvice)
    if (Object.keys(aiTips).length > 0) {
      await AdviceStore.save({
        destination: cacheKey.destination,
        startMonth: cacheKey.startMonth,
        endMonth: cacheKey.endMonth,
        travellerType: cacheKey.travellerType,
        budgetRange: cacheKey.budgetRange,
        category: GROUP_TIPS_CATEGORY,
        answers: aiTips,
      })
      return { generated: true, skipped: false, rateLimited: false }
    }
    return { generated: false, skipped: false, rateLimited: false }
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AIRateLimitedError') {
      return { generated: false, skipped: false, rateLimited: true }
    }
    console.error('[reconcileGroupTips] Failed to generate group tips:', error)
    return { generated: false, skipped: false, rateLimited: false }
  }
}

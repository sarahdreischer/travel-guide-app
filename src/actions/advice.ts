'use server'

// Advice Server Actions — Requirements 4.2, 4.3, 4.4, 4.7, 4.8
import { AdviceStore } from '@/lib/advice-store'
import type { CacheKey, AdviceRecord } from '@/lib/advice-store'
import { LLMAdapter, AdviceTimeoutError } from '@/lib/llm-adapter'
import { getSubQuestions } from '@/lib/sub-questions'
import { CATEGORIES } from '@/lib/destinations'

// ─── Types ────────────────────────────────────────────────────────────────────

export type CategoryResult =
  | { status: 'success'; record: AdviceRecord }
  | { status: 'error'; category: string; message: string }

export type AdviceActionResult = {
  results: CategoryResult[]
  errors: string[] // Categories that failed
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

      // Step 2: Cache miss — generate via LLM (Req 4.4)
      const subQuestions = getSubQuestions(category)
      const record = await LLMAdapter.generateAdvice({
        cacheKey,
        category,
        subQuestions,
      })

      results.push({ status: 'success', record })
    } catch (error: unknown) {
      if (error instanceof AdviceTimeoutError) {
        // Req 4.7: Log timeout/error server-side, return user-facing error for this category
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
        // Req 4.8: Write failure or unexpected error — log and mark category as failed
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

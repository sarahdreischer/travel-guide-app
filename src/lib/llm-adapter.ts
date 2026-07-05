// LLM_Adapter — Requirements 4.1, 4.4, 4.5, 4.7, 4.8, 5.4
import { generateText, generateObject } from 'ai'
import { openai } from '@ai-sdk/openai'
import { z } from 'zod'
import { AdviceStore } from '@/lib/advice-store'
import type { CacheKey, AdviceRecord } from '@/lib/advice-store'

// ─── Custom Error ─────────────────────────────────────────────────────────────

export class AdviceTimeoutError extends Error {
  constructor(message = 'AI advice generation timed out or failed') {
    super(message)
    this.name = 'AdviceTimeoutError'
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type { CacheKey } from '@/lib/advice-store'

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
 * Generate structured advice for a (cacheKey, category) pair.
 * Uses Vercel AI SDK generateObject with a zod schema for structured output.
 * Enforces a 30-second timeout and saves results to the advice store.
 *
 * Requirements: 4.1, 4.4, 4.5, 4.7, 4.8
 */
async function generateAdvice(params: {
  cacheKey: CacheKey
  category: string
  subQuestions: string[]
}): Promise<AdviceRecord> {
  const { cacheKey, category, subQuestions } = params
  const prompt = buildAdvicePrompt(cacheKey, category, subQuestions)

  try {
    const { object: answers } = await generateObject({
      model: getModel(),
      prompt,
      schema: z.record(z.string(), z.string()),
      abortSignal: AbortSignal.timeout(30_000),
    })

    // Persist the generated advice
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

import { getOrGenerateAdviceAction } from '@/actions/advice'
import { AdviceStore } from '@/lib/advice-store'
import type { CacheKey, AdviceRecord } from '@/lib/advice-store'
import { LLMAdapter, AdviceTimeoutError } from '@/lib/llm-adapter'
import { CATEGORIES } from '@/lib/destinations'

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('@/lib/advice-store', () => ({
  AdviceStore: {
    findByCacheKey: jest.fn(),
    save: jest.fn(),
  },
}))

jest.mock('@/lib/llm-adapter', () => ({
  LLMAdapter: {
    generateAdvice: jest.fn(),
    generateAdviceBatch: jest.fn(),
  },
  AdviceTimeoutError: class AdviceTimeoutError extends Error {
    constructor(message = 'AI advice generation timed out or failed') {
      super(message)
      this.name = 'AdviceTimeoutError'
    }
  },
  AIRateLimitedError: class AIRateLimitedError extends Error {
    constructor(message = 'AI calls are rate limited — try again later') {
      super(message)
      this.name = 'AIRateLimitedError'
    }
  },
}))

jest.mock('@/lib/sub-questions', () => ({
  getSubQuestions: jest.fn(() => ['Question 1?', 'Question 2?']),
}))

jest.mock('@/lib/ai-rate-limiter', () => ({
  canCallAI: jest.fn(() => true),
  recordAICall: jest.fn(),
  recordAIFailure: jest.fn(),
  getRateLimitStatus: jest.fn(() => ({ minuteCount: 0, maxPerMinute: 100, dayCount: 0, maxPerDay: 1000, inCooldown: false, cooldownRemainingSeconds: 0 })),
}))

// ─── Helpers ──────────────────────────────────────────────────────────────────

const mockCacheKey: CacheKey = {
  destination: 'costa rica',
  startMonth: 'january', endMonth: 'january',
  travellerType: 'solo',
  budgetRange: 'mid',
}

function makeMockRecord(category: string): AdviceRecord {
  return {
    id: `id-${category}`,
    destination: 'costa rica',
    startMonth: 'january', endMonth: 'january',
    travellerType: 'solo',
    budgetRange: 'mid',
    category,
    answers: { 'Question 1?': 'Answer 1', 'Question 2?': 'Answer 2' },
    generatedAt: new Date(),
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('getOrGenerateAdviceAction', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns cached advice for all categories on cache hit', async () => {
    const mockFindByCacheKey = AdviceStore.findByCacheKey as jest.Mock
    mockFindByCacheKey.mockImplementation((_key: CacheKey, category: string) =>
      Promise.resolve(makeMockRecord(category))
    )

    const result = await getOrGenerateAdviceAction(mockCacheKey)

    expect(result.results).toHaveLength(CATEGORIES.length)
    expect(result.errors).toHaveLength(0)
    result.results.forEach((r) => {
      expect(r.status).toBe('success')
    })
    // LLM should not be called when cache hits
    expect(LLMAdapter.generateAdviceBatch).not.toHaveBeenCalled()
  })

  it('generates advice via LLM on cache miss', async () => {
    const mockFindByCacheKey = AdviceStore.findByCacheKey as jest.Mock
    mockFindByCacheKey.mockResolvedValue(null)

    const mockGenerateAdvice = LLMAdapter.generateAdviceBatch as jest.Mock
    // Return records for all requested categories
    mockGenerateAdvice.mockImplementation((_key: unknown, cats: { category: string }[]) =>
      Promise.resolve(cats.map((c) => makeMockRecord(c.category)))
    )

    const result = await getOrGenerateAdviceAction(mockCacheKey)

    // 16 categories with questions get results (Local Etiquette has none)
    const successCount = result.results.filter((r) => r.status === 'success').length
    expect(successCount).toBeGreaterThanOrEqual(14)
    expect(result.errors).toHaveLength(0)
    // Called twice: once for priority batch, once for remaining batch
    expect(mockGenerateAdvice).toHaveBeenCalledTimes(2)
  })

  it('handles AdviceTimeoutError gracefully without failing the whole action', async () => {
    const mockFindByCacheKey = AdviceStore.findByCacheKey as jest.Mock
    mockFindByCacheKey.mockResolvedValue(null)

    const mockGenerateAdvice = LLMAdapter.generateAdviceBatch as jest.Mock
    // Priority batch times out, remaining batch succeeds
    mockGenerateAdvice
      .mockRejectedValueOnce(new AdviceTimeoutError())
      .mockImplementation((_key: unknown, cats: { category: string }[]) =>
        Promise.resolve(cats.map((c) => makeMockRecord(c.category)))
      )

    const result = await getOrGenerateAdviceAction(mockCacheKey)

    // Some errors from the failed priority batch
    expect(result.errors.length).toBeGreaterThan(0)

    // Error results should have the timeout message
    const errorResults = result.results.filter((r) => r.status === 'error')
    expect(errorResults.length).toBeGreaterThan(0)
    for (const er of errorResults) {
      if (er.status === 'error') {
        expect(er.message).toBe('Advice could not be loaded at this time')
      }
    }

    // Remaining batch should succeed
    const successResults = result.results.filter((r) => r.status === 'success')
    expect(successResults.length).toBeGreaterThan(0)
  })

  it('handles unexpected errors (e.g. write failures) gracefully', async () => {
    const mockFindByCacheKey = AdviceStore.findByCacheKey as jest.Mock
    mockFindByCacheKey.mockResolvedValue(null)

    const mockGenerateAdvice = LLMAdapter.generateAdviceBatch as jest.Mock
    // Priority batch succeeds, remaining batch has a write failure
    mockGenerateAdvice
      .mockImplementationOnce((_key: unknown, cats: { category: string }[]) =>
        Promise.resolve(cats.map((c) => makeMockRecord(c.category)))
      )
      .mockRejectedValueOnce(new Error('DB write failed'))

    const result = await getOrGenerateAdviceAction(mockCacheKey)

    // Some errors from the failed remaining batch
    expect(result.errors.length).toBeGreaterThan(0)

    // Error results should have the failure message
    const errorResults = result.results.filter((r) => r.status === 'error')
    expect(errorResults.length).toBeGreaterThan(0)
    for (const er of errorResults) {
      if (er.status === 'error') {
        expect(er.message).toBe('Advice generation failed')
      }
    }

    // Priority batch should have succeeded
    const successResults = result.results.filter((r) => r.status === 'success')
    expect(successResults.length).toBeGreaterThan(0)
  })

  it('processes a mix of cache hits, misses, and errors', async () => {
    const mockFindByCacheKey = AdviceStore.findByCacheKey as jest.Mock
    // First 5 categories are cached, rest are misses
    mockFindByCacheKey.mockImplementation((_key: CacheKey, category: string) => {
      const idx = CATEGORIES.indexOf(category as typeof CATEGORIES[number])
      if (idx < 5) return Promise.resolve(makeMockRecord(category))
      return Promise.resolve(null)
    })

    const mockGenerateAdvice = LLMAdapter.generateAdviceBatch as jest.Mock
    // First batch (priority) times out, second batch (remaining) succeeds
    mockGenerateAdvice
      .mockRejectedValueOnce(new AdviceTimeoutError())
      .mockImplementation((_key: unknown, cats: { category: string }[]) =>
        Promise.resolve(cats.map((c) => makeMockRecord(c.category)))
      )

    const result = await getOrGenerateAdviceAction(mockCacheKey)

    // Should have a mix of successes (cached + remaining batch) and errors (priority batch timeout)
    const successCount = result.results.filter((r) => r.status === 'success').length
    const errorCount = result.results.filter((r) => r.status === 'error').length

    expect(successCount).toBeGreaterThan(0) // cached ones + remaining batch
    expect(errorCount).toBeGreaterThan(0)   // priority batch failed
    expect(mockGenerateAdvice).toHaveBeenCalledTimes(2) // 2 batched calls
  })
})

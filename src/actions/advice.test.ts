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
  getRateLimitStatus: jest.fn(() => ({ callsUsed: 0, maxCalls: 100, windowMinutes: 60, inCooldown: false, cooldownRemainingSeconds: 0 })),
}))

// ─── Helpers ──────────────────────────────────────────────────────────────────

const mockCacheKey: CacheKey = {
  destination: 'costa rica',
  month: 'january',
  travellerType: 'solo',
  budgetRange: 'mid',
}

function makeMockRecord(category: string): AdviceRecord {
  return {
    id: `id-${category}`,
    destination: 'costa rica',
    month: 'january',
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

    expect(result.results).toHaveLength(15)
    expect(result.errors).toHaveLength(0)
    result.results.forEach((r) => {
      expect(r.status).toBe('success')
    })
    // LLM should not be called when cache hits
    expect(LLMAdapter.generateAdvice).not.toHaveBeenCalled()
  })

  it('generates advice via LLM on cache miss', async () => {
    const mockFindByCacheKey = AdviceStore.findByCacheKey as jest.Mock
    mockFindByCacheKey.mockResolvedValue(null)

    const mockGenerateAdvice = LLMAdapter.generateAdvice as jest.Mock
    mockGenerateAdvice.mockImplementation(({ category }: { category: string }) =>
      Promise.resolve(makeMockRecord(category))
    )

    const result = await getOrGenerateAdviceAction(mockCacheKey)

    expect(result.results).toHaveLength(15)
    expect(result.errors).toHaveLength(0)
    expect(mockGenerateAdvice).toHaveBeenCalledTimes(15)
    result.results.forEach((r) => {
      expect(r.status).toBe('success')
    })
  })

  it('handles AdviceTimeoutError gracefully without failing the whole action', async () => {
    const mockFindByCacheKey = AdviceStore.findByCacheKey as jest.Mock
    mockFindByCacheKey.mockResolvedValue(null)

    const mockGenerateAdvice = LLMAdapter.generateAdvice as jest.Mock
    // First category times out, rest succeed
    mockGenerateAdvice
      .mockRejectedValueOnce(new AdviceTimeoutError())
      .mockImplementation(({ category }: { category: string }) =>
        Promise.resolve(makeMockRecord(category))
      )

    const result = await getOrGenerateAdviceAction(mockCacheKey)

    expect(result.results).toHaveLength(15)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toBe(CATEGORIES[0])

    const errorResult = result.results[0]
    expect(errorResult.status).toBe('error')
    if (errorResult.status === 'error') {
      expect(errorResult.message).toBe('Advice could not be loaded at this time')
    }

    // Remaining 14 categories should succeed
    const successResults = result.results.filter((r) => r.status === 'success')
    expect(successResults).toHaveLength(14)
  })

  it('handles unexpected errors (e.g. write failures) gracefully', async () => {
    const mockFindByCacheKey = AdviceStore.findByCacheKey as jest.Mock
    mockFindByCacheKey.mockResolvedValue(null)

    const mockGenerateAdvice = LLMAdapter.generateAdvice as jest.Mock
    // Second category has a write failure
    mockGenerateAdvice
      .mockImplementationOnce(({ category }: { category: string }) =>
        Promise.resolve(makeMockRecord(category))
      )
      .mockRejectedValueOnce(new Error('DB write failed'))
      .mockImplementation(({ category }: { category: string }) =>
        Promise.resolve(makeMockRecord(category))
      )

    const result = await getOrGenerateAdviceAction(mockCacheKey)

    expect(result.results).toHaveLength(15)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toBe(CATEGORIES[1])

    const errorResult = result.results[1]
    expect(errorResult.status).toBe('error')
    if (errorResult.status === 'error') {
      expect(errorResult.message).toBe(
        'Advice could not be saved and will not be cached'
      )
    }
  })

  it('processes a mix of cache hits, misses, and errors', async () => {
    const mockFindByCacheKey = AdviceStore.findByCacheKey as jest.Mock
    // First 5 categories are cached, rest are misses
    mockFindByCacheKey.mockImplementation((_key: CacheKey, category: string) => {
      const idx = CATEGORIES.indexOf(category as typeof CATEGORIES[number])
      if (idx < 5) return Promise.resolve(makeMockRecord(category))
      return Promise.resolve(null)
    })

    const mockGenerateAdvice = LLMAdapter.generateAdvice as jest.Mock
    // Category at index 5 times out, rest generate fine
    let callCount = 0
    mockGenerateAdvice.mockImplementation(({ category }: { category: string }) => {
      callCount++
      if (callCount === 1) {
        return Promise.reject(new AdviceTimeoutError())
      }
      return Promise.resolve(makeMockRecord(category))
    })

    const result = await getOrGenerateAdviceAction(mockCacheKey)

    expect(result.results).toHaveLength(15)
    expect(result.errors).toHaveLength(1)
    // 5 cached + 9 generated + 1 error = 15
    const successCount = result.results.filter((r) => r.status === 'success').length
    expect(successCount).toBe(14)
    // LLM called 10 times (15 - 5 cached)
    expect(mockGenerateAdvice).toHaveBeenCalledTimes(10)
  })
})

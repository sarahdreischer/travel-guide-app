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

    expect(result.results).toHaveLength(17)
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
    mockGenerateAdvice.mockImplementation((_key: unknown, cats: { category: string }[]) =>
      Promise.resolve([makeMockRecord(cats[0].category)])
    )

    const result = await getOrGenerateAdviceAction(mockCacheKey)

    expect(result.results).toHaveLength(17)
    expect(result.errors).toHaveLength(0)
    expect(mockGenerateAdvice).toHaveBeenCalledTimes(17)
    result.results.forEach((r) => {
      expect(r.status).toBe('success')
    })
  })

  it('handles AdviceTimeoutError gracefully without failing the whole action', async () => {
    const mockFindByCacheKey = AdviceStore.findByCacheKey as jest.Mock
    mockFindByCacheKey.mockResolvedValue(null)

    const mockGenerateAdvice = LLMAdapter.generateAdviceBatch as jest.Mock
    // First category times out, rest succeed
    mockGenerateAdvice
      .mockRejectedValueOnce(new AdviceTimeoutError())
      .mockImplementation((_key: unknown, cats: { category: string }[]) =>
        Promise.resolve([makeMockRecord(cats[0].category)])
      )

    const result = await getOrGenerateAdviceAction(mockCacheKey)

    expect(result.results).toHaveLength(17)
    expect(result.errors).toHaveLength(1)

    // One category should have the timeout error
    const errorResults = result.results.filter((r) => r.status === 'error')
    expect(errorResults).toHaveLength(1)
    if (errorResults[0].status === 'error') {
      expect(errorResults[0].message).toBe('Advice could not be loaded at this time')
    }

    // Remaining categories should succeed
    const successResults = result.results.filter((r) => r.status === 'success')
    expect(successResults).toHaveLength(16)
  })

  it('handles unexpected errors (e.g. write failures) gracefully', async () => {
    const mockFindByCacheKey = AdviceStore.findByCacheKey as jest.Mock
    mockFindByCacheKey.mockResolvedValue(null)

    const mockGenerateAdvice = LLMAdapter.generateAdviceBatch as jest.Mock
    // Second category has a write failure
    mockGenerateAdvice
      .mockImplementationOnce((_key: unknown, cats: { category: string }[]) =>
        Promise.resolve([makeMockRecord(cats[0].category)])
      )
      .mockRejectedValueOnce(new Error('DB write failed'))
      .mockImplementation((_key: unknown, cats: { category: string }[]) =>
        Promise.resolve([makeMockRecord(cats[0].category)])
      )

    const result = await getOrGenerateAdviceAction(mockCacheKey)

    expect(result.results).toHaveLength(17)
    expect(result.errors).toHaveLength(1)

    // One category should have the write failure error
    const errorResults = result.results.filter((r) => r.status === 'error')
    expect(errorResults).toHaveLength(1)
    if (errorResults[0].status === 'error') {
      expect(errorResults[0].message).toBe(
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

    const mockGenerateAdvice = LLMAdapter.generateAdviceBatch as jest.Mock
    // Category at index 5 times out, rest generate fine
    let callCount = 0
    mockGenerateAdvice.mockImplementation((_key: unknown, cats: { category: string }[]) => {
      callCount++
      if (callCount === 1) {
        return Promise.reject(new AdviceTimeoutError())
      }
      return Promise.resolve([makeMockRecord(cats[0].category)])
    })

    const result = await getOrGenerateAdviceAction(mockCacheKey)

    expect(result.results).toHaveLength(17)
    expect(result.errors).toHaveLength(1)
    // 5 cached + 11 generated + 1 error = 17
    const successCount = result.results.filter((r) => r.status === 'success').length
    expect(successCount).toBe(16)
    // LLM called 12 times (17 - 5 cached)
    expect(mockGenerateAdvice).toHaveBeenCalledTimes(12)
  })
})

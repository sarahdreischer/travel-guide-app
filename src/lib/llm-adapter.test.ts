/* eslint-disable @typescript-eslint/no-explicit-any */
import { LLMAdapter, AdviceTimeoutError } from '@/lib/llm-adapter'
import type { CacheKey } from '@/lib/advice-store'

// Mock the AI SDK modules
jest.mock('ai', () => ({
  generateObject: jest.fn(),
  generateText: jest.fn(),
}))

jest.mock('@ai-sdk/openai', () => ({
  openai: jest.fn(() => 'mock-model'),
}))

jest.mock('@/lib/advice-store', () => ({
  AdviceStore: {
    findByCacheKey: jest.fn().mockResolvedValue(null),
    save: jest.fn(),
  },
}))

jest.mock('@/lib/ai-rate-limiter', () => ({
  canCallAI: jest.fn(() => true),
  recordAICall: jest.fn(),
  recordAIFailure: jest.fn(),
  getRateLimitStatus: jest.fn(() => ({ minuteCount: 0, maxPerMinute: 100, dayCount: 0, maxPerDay: 1000, inCooldown: false, cooldownRemainingSeconds: 0 })),
}))

import { generateObject, generateText } from 'ai'
import { AdviceStore } from '@/lib/advice-store'

const mockGenerateObject = generateObject as jest.MockedFunction<typeof generateObject>
const mockGenerateText = generateText as jest.MockedFunction<typeof generateText>
const mockSave = AdviceStore.save as jest.MockedFunction<typeof AdviceStore.save>

describe('LLMAdapter', () => {
  const sampleCacheKey: CacheKey = {
    destination: 'costa rica',
    startMonth: 'january', endMonth: 'january',
    travellerType: 'solo',
    budgetRange: 'mid',
  }

  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('generateAdvice', () => {
    it('generates advice, saves to store, and returns the record', async () => {
      const answers = {
        'Is driving recommended?': 'Yes, highly recommended for exploring.',
        'Are roads in good condition?': 'Main roads are good, rural roads vary.',
      }

      const savedRecord = {
        id: 'abc-123',
        destination: 'costa rica',
        startMonth: 'january', endMonth: 'january',
        travellerType: 'solo',
        budgetRange: 'mid',
        category: 'Transportation – Driving',
        answers,
        generatedAt: new Date(),
      }

      // Batch response: category name → answers object
      mockGenerateObject.mockResolvedValue({
        object: { 'Transportation – Driving': answers },
      } as any)

      mockSave.mockResolvedValue(savedRecord)

      const result = await LLMAdapter.generateAdvice({
        cacheKey: sampleCacheKey,
        category: 'Transportation – Driving',
        subQuestions: ['Is driving recommended?', 'Are roads in good condition?'],
      })

      expect(result).toEqual(savedRecord)
      expect(mockGenerateObject).toHaveBeenCalledTimes(1)
      expect(mockSave).toHaveBeenCalledWith({
        destination: 'costa rica',
        startMonth: 'january', endMonth: 'january',
        travellerType: 'solo',
        budgetRange: 'mid',
        category: 'Transportation – Driving',
        answers,
      })
    })

    it('includes all sub-questions in the prompt', async () => {
      const subQuestions = ['Question 1?', 'Question 2?', 'Question 3?']

      mockGenerateObject.mockResolvedValue({ object: { 'Safety': {} } } as any)
      mockSave.mockResolvedValue({} as any)

      await LLMAdapter.generateAdvice({
        cacheKey: sampleCacheKey,
        category: 'Safety',
        subQuestions,
      }).catch(() => {}) // may throw if category not in response

      const callArgs = mockGenerateObject.mock.calls[0][0]
      expect(callArgs.prompt).toContain('1. Question 1?')
      expect(callArgs.prompt).toContain('2. Question 2?')
      expect(callArgs.prompt).toContain('3. Question 3?')
      expect(callArgs.prompt).toContain('Safety')
    })

    it('throws AdviceTimeoutError on AbortError (timeout)', async () => {
      const abortError = new Error('The operation was aborted')
      abortError.name = 'AbortError'
      mockGenerateObject.mockRejectedValue(abortError)

      await expect(
        LLMAdapter.generateAdvice({
          cacheKey: sampleCacheKey,
          category: 'Weather',
          subQuestions: ['Is it sunny?'],
        }),
      ).rejects.toThrow(AdviceTimeoutError)

      expect(console.error).toHaveBeenCalledWith(
        '[LLM_Adapter] Batch advice generation timed out:',
        expect.objectContaining({ destination: 'costa rica' }),
      )
    })

    it('throws AdviceTimeoutError on generic errors', async () => {
      mockGenerateObject.mockRejectedValue(new Error('Network failure'))

      await expect(
        LLMAdapter.generateAdvice({
          cacheKey: sampleCacheKey,
          category: 'Food',
          subQuestions: ['Is tipping expected?'],
        }),
      ).rejects.toThrow(AdviceTimeoutError)

      expect(console.error).toHaveBeenCalledWith(
        '[LLM_Adapter] Batch advice generation failed:',
        expect.any(Error),
      )
    })
  })

  describe('summarise', () => {
    it('returns generated summary text', async () => {
      mockGenerateText.mockResolvedValue({
        text: 'Costa Rica is great for budget solo travellers in January.',
      } as any)

      const result = await LLMAdapter.summarise('Long advice text about Costa Rica...')

      expect(result).toBe('Costa Rica is great for budget solo travellers in January.')
      expect(mockGenerateText).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'mock-model',
          prompt: expect.stringContaining('Long advice text about Costa Rica...'),
          abortSignal: expect.any(AbortSignal),
        }),
      )
    })

    it('returns original text on error (graceful fallback)', async () => {
      mockGenerateText.mockRejectedValue(new Error('API down'))

      const originalText = 'Full advice text that should be returned as fallback'
      const result = await LLMAdapter.summarise(originalText)

      expect(result).toBe(originalText)
      expect(console.error).toHaveBeenCalledWith(
        '[LLM_Adapter] Summarise failed:',
        expect.any(Error),
      )
    })
  })

  describe('AdviceTimeoutError', () => {
    it('has correct name and default message', () => {
      const error = new AdviceTimeoutError()
      expect(error.name).toBe('AdviceTimeoutError')
      expect(error.message).toBe('AI advice generation timed out or failed')
      expect(error).toBeInstanceOf(Error)
    })

    it('accepts a custom message', () => {
      const error = new AdviceTimeoutError('Custom timeout message')
      expect(error.message).toBe('Custom timeout message')
    })
  })
})

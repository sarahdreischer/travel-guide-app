import { NoObjectGeneratedError } from 'ai'
import { isProviderFailure, AdviceTimeoutError, AIRateLimitedError } from '@/lib/ai-errors'

describe('isProviderFailure', () => {
  it('treats a NoObjectGeneratedError (schema mismatch) as a CONTENT failure (not provider)', () => {
    // The SDK constructor requires response/usage metadata; supply minimal
    // stubs (the classifier only cares that it's a NoObjectGeneratedError).
    const err = new NoObjectGeneratedError({
      message: 'No object generated: response did not match schema.',
      cause: undefined,
      text: '{bad',
      response: { id: 'r', timestamp: new Date(), modelId: 'gpt-4o-mini' },
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    })
    expect(NoObjectGeneratedError.isInstance(err)).toBe(true)
    expect(isProviderFailure(err)).toBe(false)
  })

  it('treats a name-based No-object error as a content failure too', () => {
    const err = new Error('No object generated: response did not match schema.')
    err.name = 'AI_NoObjectGeneratedError'
    expect(isProviderFailure(err)).toBe(false)
  })

  it('treats timeouts/aborts as provider failures', () => {
    const timeout = new Error('aborted')
    timeout.name = 'TimeoutError'
    expect(isProviderFailure(timeout)).toBe(true)

    const abort = new Error('The operation was aborted')
    abort.name = 'AbortError'
    expect(isProviderFailure(abort)).toBe(true)
  })

  it('treats rate-limit / 429 / 5xx / network messages as provider failures', () => {
    expect(isProviderFailure(new Error('OpenAI rate limit exceeded'))).toBe(true)
    expect(isProviderFailure(new Error('Request failed with status 429'))).toBe(true)
    expect(isProviderFailure(new Error('502 Bad Gateway'))).toBe(true)
    expect(isProviderFailure(new Error('fetch failed'))).toBe(true)
    expect(isProviderFailure(new Error('ECONNRESET'))).toBe(true)
  })

  it('treats a Zod-style validation message as a content failure', () => {
    expect(isProviderFailure(new Error('Invalid input: expected string, received number'))).toBe(false)
  })

  it('treats unknown non-Error throwables conservatively as non-provider', () => {
    expect(isProviderFailure('some string')).toBe(false)
    expect(isProviderFailure(null)).toBe(false)
  })
})

describe('AI error types', () => {
  it('AdviceTimeoutError has the expected name/message', () => {
    const e = new AdviceTimeoutError()
    expect(e.name).toBe('AdviceTimeoutError')
    expect(e).toBeInstanceOf(Error)
  })

  it('AIRateLimitedError has the expected name', () => {
    const e = new AIRateLimitedError()
    expect(e.name).toBe('AIRateLimitedError')
    expect(e).toBeInstanceOf(Error)
  })
})

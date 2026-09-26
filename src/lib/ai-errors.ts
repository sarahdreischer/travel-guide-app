/**
 * Shared AI error types for the generation pipeline.
 *
 * These previously lived in the (now removed) legacy llm-adapter; the
 * structured pipeline (destination research + trip-guide generation) throws
 * them, so they live here in a legacy-free module.
 */

/** Thrown when an AI generation call times out or otherwise fails to produce output. */
export class AdviceTimeoutError extends Error {
  constructor(message = 'AI generation timed out or failed') {
    super(message)
    this.name = 'AdviceTimeoutError'
  }
}

/** Thrown when an AI call is refused because the rate limit is exhausted. */
export class AIRateLimitedError extends Error {
  constructor(message = 'AI calls are rate limited — try again later') {
    super(message)
    this.name = 'AIRateLimitedError'
  }
}

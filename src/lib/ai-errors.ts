/**
 * Shared AI error types + classification for the generation pipeline.
 *
 * These previously lived in the (now removed) legacy llm-adapter; the
 * structured pipeline (destination research + trip-guide generation) throws
 * them, so they live here in a legacy-free module.
 */

import { NoObjectGeneratedError } from 'ai'

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

/**
 * Classify an error as a PROVIDER/transport failure (the provider is
 * unavailable, timing out, overloaded, or rate-limiting us) versus a CONTENT
 * failure (the model responded fine, but its output didn't match the schema /
 * couldn't be parsed).
 *
 * Why this matters: the rate limiter applies a global cooldown after a
 * provider failure to avoid hammering a failing provider. A schema-mismatch
 * (`NoObjectGeneratedError`) is NOT a provider problem — the provider answered
 * — so it must NOT trip that cooldown, otherwise one malformed response blocks
 * all unrelated AI calls for minutes (the "rate limited … cooldown: true" seen
 * after just a couple of calls).
 *
 * Returns true only for genuine provider/transport failures.
 */
export function isProviderFailure(error: unknown): boolean {
  // Content failure: model produced output that didn't match the schema.
  // Guard the whole reference in case the SDK export is unavailable (e.g. under
  // a partial test mock of the `ai` module).
  try {
    if (
      typeof NoObjectGeneratedError !== 'undefined' &&
      NoObjectGeneratedError !== null &&
      (NoObjectGeneratedError.isInstance?.(error) ?? error instanceof NoObjectGeneratedError)
    ) {
      return false
    }
  } catch {
    // Fall through to name/message-based classification below.
  }

  if (!(error instanceof Error)) {
    // Unknown, non-Error throwable — be conservative and don't trip cooldown.
    return false
  }

  const name = error.name
  const message = error.message.toLowerCase()

  // Timeouts / aborts are provider/transport failures.
  if (name === 'AbortError' || name === 'TimeoutError') return true

  // AI SDK / provider transport errors.
  if (name === 'APICallError' || name === 'RetryError' || name === 'DownloadError') return true

  // Common transport signals in the message.
  if (
    message.includes('rate limit') ||
    message.includes('429') ||
    message.includes('overloaded') ||
    message.includes('timeout') ||
    message.includes('timed out') ||
    message.includes('econnreset') ||
    message.includes('etimedout') ||
    message.includes('network') ||
    message.includes('fetch failed') ||
    /\b5\d\d\b/.test(message) // 5xx
  ) {
    return true
  }

  // Content/validation failures (Zod, JSON parse, "did not match schema") are
  // NOT provider failures.
  return false
}

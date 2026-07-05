/**
 * Simple in-memory rate limiter for AI API calls.
 * Limits the number of LLM generation calls per configurable time window.
 *
 * Configurable via environment variables:
 * - AI_MAX_CALLS_PER_WINDOW: Maximum LLM calls per window (default: 2)
 * - AI_RATE_WINDOW_MINUTES: Length of the sliding window in minutes (default: 60)
 */

const MAX_CALLS_PER_WINDOW = parseInt(process.env.AI_MAX_CALLS_PER_WINDOW ?? '2', 10)
const WINDOW_MINUTES = parseInt(process.env.AI_RATE_WINDOW_MINUTES ?? '60', 10)
const WINDOW_MS = WINDOW_MINUTES * 60 * 1000

// In-memory call timestamps (resets on server restart)
const callTimestamps: number[] = []

/**
 * Check if we can make another AI call within the rate limit window.
 * Returns true if under the limit, false if rate limited.
 */
export function canCallAI(): boolean {
  const now = Date.now()
  // Remove timestamps older than the window
  while (callTimestamps.length > 0 && callTimestamps[0] < now - WINDOW_MS) {
    callTimestamps.shift()
  }
  return callTimestamps.length < MAX_CALLS_PER_WINDOW
}

/**
 * Record that an AI call was made. Call this after a successful or attempted LLM call.
 */
export function recordAICall(): void {
  callTimestamps.push(Date.now())
}

/**
 * Get the current rate limit status for diagnostics.
 */
export function getRateLimitStatus(): { callsUsed: number; maxCalls: number; windowMinutes: number; windowMs: number } {
  const now = Date.now()
  while (callTimestamps.length > 0 && callTimestamps[0] < now - WINDOW_MS) {
    callTimestamps.shift()
  }
  return {
    callsUsed: callTimestamps.length,
    maxCalls: MAX_CALLS_PER_WINDOW,
    windowMinutes: WINDOW_MINUTES,
    windowMs: WINDOW_MS,
  }
}

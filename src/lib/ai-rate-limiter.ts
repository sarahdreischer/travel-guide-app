/**
 * In-memory rate limiter for AI API calls.
 * Tracks actual AI provider calls (successful and failed) to enforce limits.
 * Also implements a cooldown after failures to avoid hammering a failing provider.
 *
 * Configurable via environment variables:
 * - AI_MAX_CALLS_PER_WINDOW: Maximum AI calls per window (default: 2)
 * - AI_RATE_WINDOW_MINUTES: Sliding window length in minutes (default: 60)
 * - AI_FAILURE_COOLDOWN_MINUTES: Pause all calls for this many minutes after a failure (default: 5)
 */

const MAX_CALLS_PER_WINDOW = parseInt(process.env.AI_MAX_CALLS_PER_WINDOW ?? '2', 10)
const WINDOW_MINUTES = parseInt(process.env.AI_RATE_WINDOW_MINUTES ?? '60', 10)
const WINDOW_MS = WINDOW_MINUTES * 60 * 1000
const FAILURE_COOLDOWN_MINUTES = parseInt(process.env.AI_FAILURE_COOLDOWN_MINUTES ?? '5', 10)
const FAILURE_COOLDOWN_MS = FAILURE_COOLDOWN_MINUTES * 60 * 1000

// In-memory state (resets on server restart)
const callTimestamps: number[] = []
let lastFailureAt: number | null = null

/**
 * Prune timestamps older than the window.
 */
function pruneOldTimestamps(): void {
  const now = Date.now()
  while (callTimestamps.length > 0 && callTimestamps[0] < now - WINDOW_MS) {
    callTimestamps.shift()
  }
}

/**
 * Check if we can make another AI call.
 * Returns false if:
 * - We've hit the max calls per window, OR
 * - We're in a failure cooldown period
 */
export function canCallAI(): boolean {
  // Check failure cooldown first
  if (lastFailureAt !== null) {
    const timeSinceFailure = Date.now() - lastFailureAt
    if (timeSinceFailure < FAILURE_COOLDOWN_MS) {
      return false
    }
    // Cooldown expired — clear the failure marker
    lastFailureAt = null
  }

  pruneOldTimestamps()
  return callTimestamps.length < MAX_CALLS_PER_WINDOW
}

/**
 * Record that an AI call was made (call AFTER the API request is sent,
 * regardless of success/failure — we want to count attempts against the window).
 */
export function recordAICall(): void {
  callTimestamps.push(Date.now())
}

/**
 * Record that an AI call failed. Activates the cooldown period to prevent
 * hammering a failing provider on every page load.
 */
export function recordAIFailure(): void {
  lastFailureAt = Date.now()
}

/**
 * Get the current rate limit status for diagnostics/logging.
 */
export function getRateLimitStatus(): {
  callsUsed: number
  maxCalls: number
  windowMinutes: number
  inCooldown: boolean
  cooldownRemainingSeconds: number
} {
  pruneOldTimestamps()

  let inCooldown = false
  let cooldownRemainingSeconds = 0

  if (lastFailureAt !== null) {
    const elapsed = Date.now() - lastFailureAt
    if (elapsed < FAILURE_COOLDOWN_MS) {
      inCooldown = true
      cooldownRemainingSeconds = Math.ceil((FAILURE_COOLDOWN_MS - elapsed) / 1000)
    }
  }

  return {
    callsUsed: callTimestamps.length,
    maxCalls: MAX_CALLS_PER_WINDOW,
    windowMinutes: WINDOW_MINUTES,
    inCooldown,
    cooldownRemainingSeconds,
  }
}

/**
 * In-memory rate limiter for AI API calls with dual-window enforcement.
 * Enforces both a per-minute and per-day limit simultaneously.
 * A call is allowed only if BOTH windows have remaining capacity.
 *
 * Also implements a cooldown after failures to avoid hammering a failing provider.
 *
 * Priority: callers can pass a priority. High-priority work (foreground
 * new-trip advice generation) may use the full per-minute budget. Low-priority
 * work (background reconciliation) is refused once the per-minute count reaches
 * a reserve threshold, leaving headroom so a freshly-created trip is never
 * starved by background jobs.
 *
 * Configurable via environment variables:
 * - AI_MAX_CALLS_PER_MINUTE: Maximum AI calls per minute (default: 3)
 * - AI_MAX_CALLS_PER_DAY: Maximum AI calls per 24h rolling window (default: 50)
 * - AI_FAILURE_COOLDOWN_MINUTES: Pause all calls for this many minutes after a failure (default: 5)
 * - AI_LOW_PRIORITY_MINUTE_RESERVE: Per-minute slots reserved for high-priority
 *   work; low-priority calls are refused once the minute count reaches
 *   (MAX_PER_MINUTE - this). Default: 1.
 */

export type AICallPriority = 'high' | 'low'

const MAX_PER_MINUTE = parseInt(process.env.AI_MAX_CALLS_PER_MINUTE ?? '3', 10)
const MAX_PER_DAY = parseInt(process.env.AI_MAX_CALLS_PER_DAY ?? '50', 10)
const FAILURE_COOLDOWN_MINUTES = parseInt(process.env.AI_FAILURE_COOLDOWN_MINUTES ?? '5', 10)

// Per-minute slots kept in reserve for high-priority (foreground) work.
// Low-priority (background) calls stop once the minute count reaches
// MAX_PER_MINUTE - LOW_PRIORITY_MINUTE_RESERVE. Clamped so at least 1 slot
// stays available to low priority when the reserve would consume the whole
// budget.
const LOW_PRIORITY_MINUTE_RESERVE = Math.min(
  Math.max(0, parseInt(process.env.AI_LOW_PRIORITY_MINUTE_RESERVE ?? '1', 10)),
  Math.max(0, MAX_PER_MINUTE - 1)
)

const ONE_MINUTE_MS = 60 * 1000
const ONE_DAY_MS = 24 * 60 * 60 * 1000
const FAILURE_COOLDOWN_MS = FAILURE_COOLDOWN_MINUTES * 60 * 1000

// In-memory state (resets on server restart)
const callTimestamps: number[] = []
let lastFailureAt: number | null = null

/**
 * Count timestamps within a given window (ms ago from now).
 */
function countInWindow(windowMs: number): number {
  const cutoff = Date.now() - windowMs
  let count = 0
  for (let i = callTimestamps.length - 1; i >= 0; i--) {
    if (callTimestamps[i] >= cutoff) {
      count++
    } else {
      break
    }
  }
  return count
}

/**
 * Prune timestamps older than the largest window (1 day).
 */
function prune(): void {
  const cutoff = Date.now() - ONE_DAY_MS
  while (callTimestamps.length > 0 && callTimestamps[0] < cutoff) {
    callTimestamps.shift()
  }
}

/**
 * Check if we can make another AI call.
 * Returns false if:
 * - Per-minute limit reached, OR
 * - Per-day limit reached, OR
 * - In failure cooldown period
 */
export function canCallAI(priority: AICallPriority = 'high'): boolean {
  // Check failure cooldown first
  if (lastFailureAt !== null) {
    if (Date.now() - lastFailureAt < FAILURE_COOLDOWN_MS) {
      return false
    }
    lastFailureAt = null
  }

  prune()
  const minuteCount = countInWindow(ONE_MINUTE_MS)

  // Low-priority (background) work must leave headroom for high-priority
  // (foreground new-trip) work, so it stops earlier in the per-minute window.
  const minuteLimit =
    priority === 'low' ? MAX_PER_MINUTE - LOW_PRIORITY_MINUTE_RESERVE : MAX_PER_MINUTE
  if (minuteCount >= minuteLimit) return false

  const dayCount = countInWindow(ONE_DAY_MS)
  if (dayCount >= MAX_PER_DAY) return false

  return true
}

/**
 * Record that an AI call was made.
 */
export function recordAICall(): void {
  callTimestamps.push(Date.now())
}

/**
 * Record that an AI call failed. Activates cooldown.
 */
export function recordAIFailure(): void {
  lastFailureAt = Date.now()
}

/**
 * Get the current rate limit status for diagnostics/logging.
 */
export function getRateLimitStatus(): {
  minuteCount: number
  maxPerMinute: number
  dayCount: number
  maxPerDay: number
  inCooldown: boolean
  cooldownRemainingSeconds: number
} {
  prune()

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
    minuteCount: countInWindow(ONE_MINUTE_MS),
    maxPerMinute: MAX_PER_MINUTE,
    dayCount: countInWindow(ONE_DAY_MS),
    maxPerDay: MAX_PER_DAY,
    inCooldown,
    cooldownRemainingSeconds,
  }
}


// ─── Periodic rate limit logger (every 5 minutes) ─────────────────────────────

if (typeof globalThis !== 'undefined' && !(globalThis as Record<string, unknown>).__rateLimitLoggerStarted) {
  (globalThis as Record<string, unknown>).__rateLimitLoggerStarted = true
  setInterval(() => {
    const status = getRateLimitStatus()
    console.log(
      `[AI Rate Limit] ${new Date().toISOString()} — minute: ${status.minuteCount}/${status.maxPerMinute}, day: ${status.dayCount}/${status.maxPerDay}, cooldown: ${status.inCooldown}`
    )
  }, 5 * 60 * 1000)
}

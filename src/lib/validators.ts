// Pure validation helpers — Requirements 2.3, 2.4, 2.7, 3.1, 3.5, 3.6, 4.1, 7.4, 7.8, 9.2, 9.3

// ─── Types ────────────────────────────────────────────────────────────────────

export type BudgetTier = 'budget' | 'mid' | 'luxury'
export type TravelMode = 'Solo' | 'Friends' | 'Couple' | 'Family'

export type CacheKey = {
  destination: string
  month: string
  travellerType: TravelMode
  budgetRange: BudgetTier
}

export type ImageValidationResult =
  | { valid: true }
  | { valid: false; error: 'invalid_format' | 'file_too_large' }

export type TripDateValidationResult =
  | { valid: true }
  | { valid: false; error: 'start_date_in_past' | 'end_before_start' }

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCEPTED_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_IMAGE_SIZE_BYTES = 5_242_880 // 5 MB

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Strip time component from a Date so comparisons are calendar-day granular. */
function toCalendarDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

// ─── Validators ──────────────────────────────────────────────────────────────

/**
 * Maps a numeric USD budget to one of three tiers.
 * - $1–$99 → 'budget'
 * - $100–$499 → 'mid'
 * - $500–$1,000,000 → 'luxury'
 *
 * Throws a RangeError if `usd` is outside 1–1,000,000.
 *
 * Requirements: 3.1, 4.1
 */
export function derivebudgetRange(usd: number): BudgetTier {
  if (usd < 1 || usd > 1_000_000) {
    throw new RangeError(`Budget must be between 1 and 1,000,000 USD; got ${usd}`)
  }
  if (usd < 100) return 'budget'
  if (usd < 500) return 'mid'
  return 'luxury'
}

/**
 * Returns true if the username is between 1 and 255 characters inclusive.
 *
 * Requirements: 9.2
 */
export function validateUsername(name: string): boolean {
  return name.length >= 1 && name.length <= 255
}

/**
 * Returns true if the experience note is between 1 and 500 characters inclusive.
 *
 * Requirements: 7.4, 7.8
 */
export function validateExperienceNote(text: string): boolean {
  return text.length >= 1 && text.length <= 500
}

/**
 * Validates a profile image upload.
 * Accepts iff mimeType ∈ {image/jpeg, image/png, image/webp} AND size ≤ 5 MB.
 * Format is checked before size so the more specific error surfaces first.
 *
 * Requirements: 2.7, 9.3
 */
export function validateProfileImage(file: {
  mimeType: string
  size: number
}): ImageValidationResult {
  if (!ACCEPTED_IMAGE_MIME_TYPES.has(file.mimeType)) {
    return { valid: false, error: 'invalid_format' }
  }
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return { valid: false, error: 'file_too_large' }
  }
  return { valid: true }
}

/**
 * Returns true if the email matches a practical local-part@domain.tld pattern.
 * Checks for exactly one @, a non-empty local part, and a domain with at least one dot.
 *
 * Requirements: 2.4
 */
export function validateEmail(email: string): boolean {
  // One @ separating a non-empty local part from a domain that contains at least one dot
  // and has non-empty segments on both sides of every dot.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

/**
 * Validates trip date range at calendar-day granularity.
 * - Returns 'start_date_in_past' if start < today.
 * - Returns 'end_before_start' if end < start.
 * - If both conditions are true, 'start_date_in_past' is returned first.
 *
 * Requirements: 3.5, 3.6
 */
export function validateTripDates(start: Date, end: Date): TripDateValidationResult {
  const today = toCalendarDay(new Date())
  const startDay = toCalendarDay(start)
  const endDay = toCalendarDay(end)

  if (startDay < today) {
    return { valid: false, error: 'start_date_in_past' }
  }
  if (endDay < startDay) {
    return { valid: false, error: 'end_before_start' }
  }
  return { valid: true }
}

/**
 * Normalises a CacheKey for consistent storage and lookup.
 * Applies .toLowerCase().trim() to destination, month, and travellerType.
 * budgetRange is a typed enum and is left unchanged.
 *
 * Requirements: 4.2
 */
export function normaliseCacheKey(key: CacheKey): CacheKey {
  return {
    destination: key.destination.toLowerCase().trim(),
    month: key.month.toLowerCase().trim(),
    travellerType: key.travellerType.toLowerCase().trim() as TravelMode,
    budgetRange: key.budgetRange,
  }
}

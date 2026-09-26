/**
 * Neutral trip cache-key helpers, shared by the structured two-stage pipeline.
 *
 * `deriveMonthRange` previously lived in the (now removed) legacy advice-store;
 * it is used by the trip-guide store and the trip-guide action to build the
 * structured guide's cache key, so it lives here in a legacy-free module.
 */

/**
 * Derive the lower-cased month range from a trip's start and end dates, e.g.
 * `{ startMonth: 'november', endMonth: 'november' }`.
 */
export function deriveMonthRange(
  startDate: string | Date,
  endDate: string | Date
): { startMonth: string; endMonth: string } {
  const start = new Date(startDate)
  const end = new Date(endDate)
  return {
    startMonth: start.toLocaleString('en', { month: 'long' }).toLowerCase(),
    endMonth: end.toLocaleString('en', { month: 'long' }).toLowerCase(),
  }
}

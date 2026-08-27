/**
 * Format an ISO date string (YYYY-MM-DD) into a short human-readable date.
 * e.g. "14 Aug 2026"
 */
export function fmtDate(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value + 'T00:00:00') : value
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/**
 * Format an ISO date string without the year.
 * e.g. "14 Aug"
 */
export function fmtDateShort(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value + 'T00:00:00') : value
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

/**
 * Format a date range: "14 Aug – 21 Aug 2026"
 */
export function fmtDateRange(start: string | Date, end: string | Date): string {
  const s = typeof start === 'string' ? new Date(start + 'T00:00:00') : start
  const e = typeof end === 'string' ? new Date(end + 'T00:00:00') : end
  const sameYear = s.getFullYear() === e.getFullYear()
  const startStr = s.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  })
  const endStr = e.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  return `${startStr} – ${endStr}`
}

/**
 * Number of nights between two ISO date strings.
 */
export function nightCount(start: string, end: string): number {
  const diff =
    (new Date(end + 'T00:00:00').getTime() - new Date(start + 'T00:00:00').getTime()) / 86_400_000
  return Math.max(0, Math.round(diff))
}

/**
 * Relative time description from today to the trip window.
 * e.g. "In 3 weeks", "In progress", "2 months ago"
 */
export function relativeTime(startIso: string, endIso: string): string {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const start = new Date(startIso + 'T00:00:00')
  const end = new Date(endIso + 'T00:00:00')
  const daysToStart = Math.round((start.getTime() - now.getTime()) / 86_400_000)
  const daysToEnd = Math.round((end.getTime() - now.getTime()) / 86_400_000)

  if (daysToStart > 0) {
    if (daysToStart === 1) return 'Tomorrow'
    if (daysToStart < 7) return `In ${daysToStart} days`
    if (daysToStart < 30) return `In ${Math.round(daysToStart / 7)} week${Math.round(daysToStart / 7) !== 1 ? 's' : ''}`
    if (daysToStart < 365) return `In ${Math.round(daysToStart / 30)} month${Math.round(daysToStart / 30) !== 1 ? 's' : ''}`
    return `In ${Math.round(daysToStart / 365)} year${daysToStart > 500 ? 's' : ''}`
  }
  if (daysToEnd >= 0) return 'In progress'
  const ago = Math.abs(daysToEnd)
  if (ago < 7) return `${ago} day${ago !== 1 ? 's' : ''} ago`
  if (ago < 30) return `${Math.round(ago / 7)} week${Math.round(ago / 7) !== 1 ? 's' : ''} ago`
  if (ago < 365) return `${Math.round(ago / 30)} month${Math.round(ago / 30) !== 1 ? 's' : ''} ago`
  return `${Math.round(ago / 365)} year${ago > 500 ? 's' : ''} ago`
}

/**
 * True when the trip end date is today or in the future.
 */
export function isUpcoming(endIso: string): boolean {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return new Date(endIso + 'T00:00:00') >= now
}

/**
 * Small helpers for splitting the app's "City, Country" destination strings
 * into a destination + country pair for the research stage.
 *
 * DESTINATIONS are stored as e.g. "Phuket, Thailand" or "London, United
 * Kingdom". A few are single-token. This keeps the split logic in one place.
 */

export interface DestinationParts {
  destination: string
  country: string
}

/**
 * Split a "City, Country" string. If there is no comma, the whole string is
 * treated as both the destination and the country (best effort).
 */
export function splitDestination(raw: string): DestinationParts {
  const trimmed = raw.trim()
  const commaIdx = trimmed.lastIndexOf(',')
  if (commaIdx === -1) {
    return { destination: trimmed, country: trimmed }
  }
  const destination = trimmed.slice(0, commaIdx).trim()
  const country = trimmed.slice(commaIdx + 1).trim()
  return {
    destination: destination || trimmed,
    country: country || trimmed,
  }
}

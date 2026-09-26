/**
 * DestinationFacts cache/persistence (stage-1 output).
 *
 * Destination research is expensive and destination facts are stable, so we
 * cache them per (destination, country) and reuse them across every trip to
 * that destination — 100 trips to Phuket reuse a single researched row.
 *
 * The cache is independently refreshable (getOrResearch(..., { forceRefresh })
 * / refresh()) so destination facts can be updated without touching individual
 * trip guides. Staleness uses a generous TTL appropriate for STABLE facts;
 * expiry logic is intentionally minimal for this first implementation.
 */

import { db } from '@/db'
import { destinationFacts } from '@/db/schema'
import type { DestinationFactsRow } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import {
  DestinationFactsSchema,
  safeParseDestinationFacts,
  type DestinationFacts,
} from '@/lib/schemas/destination-facts'
import { researchDestination } from '@/lib/destination-research'
import type { AICallPriority } from '@/lib/ai-rate-limiter'

// Stable facts change rarely; refresh at most a few times a year by default.
const DEFAULT_TTL_DAYS = parseInt(process.env.DESTINATION_FACTS_TTL_DAYS ?? '180', 10)
const TTL_MS = DEFAULT_TTL_DAYS * 24 * 60 * 60 * 1000

// ─── Read ─────────────────────────────────────────────────────────────────────

/** Fetch the raw cached row for a (destination, country), or null. */
async function findRow(destination: string, country: string): Promise<DestinationFactsRow | null> {
  const rows = await db
    .select()
    .from(destinationFacts)
    .where(and(eq(destinationFacts.destination, destination), eq(destinationFacts.country, country)))
    .limit(1)
  return rows[0] ?? null
}

/** Fetch validated cached facts for a (destination, country), or null. */
async function get(destination: string, country: string): Promise<DestinationFacts | null> {
  const row = await findRow(destination, country)
  if (!row) return null
  const parsed = safeParseDestinationFacts(row.facts)
  if (!parsed.success) {
    console.warn(`[destination-facts-store] Cached facts for "${destination}, ${country}" failed validation — treating as absent`)
    return null
  }
  return parsed.data
}

function isStale(row: DestinationFactsRow): boolean {
  return Date.now() - new Date(row.lastResearchedAt).getTime() > TTL_MS
}

// ─── Write ────────────────────────────────────────────────────────────────────

/** Upsert validated facts for a (destination, country) and bump the timestamp. */
async function save(
  destination: string,
  country: string,
  facts: DestinationFacts
): Promise<DestinationFacts> {
  // Validate before persisting — never store an invalid facts blob.
  const validated = DestinationFactsSchema.parse(facts)

  await db
    .insert(destinationFacts)
    .values({ destination, country, facts: validated, lastResearchedAt: new Date() })
    .onConflictDoUpdate({
      target: [destinationFacts.destination, destinationFacts.country],
      set: { facts: validated, lastResearchedAt: new Date() },
    })

  return validated
}

// ─── Cache-aware research ──────────────────────────────────────────────────

export interface GetOrResearchOptions {
  priority?: AICallPriority
  /** Ignore any cached row and re-research (manual refresh). */
  forceRefresh?: boolean
}

/**
 * Return cached DestinationFacts if present and fresh, otherwise research the
 * destination, persist, and return the result.
 *
 *   destination → cached & fresh?  → yes: use
 *                                   → no/stale/forced: research → validate → persist → use
 */
async function getOrResearch(
  destination: string,
  country: string,
  options: GetOrResearchOptions = {}
): Promise<DestinationFacts> {
  const { priority = 'high', forceRefresh = false } = options

  if (!forceRefresh) {
    const row = await findRow(destination, country)
    if (row && !isStale(row)) {
      const parsed = safeParseDestinationFacts(row.facts)
      if (parsed.success) return parsed.data
      console.warn(`[destination-facts-store] Ignoring invalid cached facts for "${destination}, ${country}" — re-researching`)
    }
  }

  const facts = await researchDestination({ destination, country, priority })
  return save(destination, country, facts)
}

/** Force a fresh research pass and persist it (manual refresh entry point). */
async function refresh(
  destination: string,
  country: string,
  priority: AICallPriority = 'high'
): Promise<DestinationFacts> {
  return getOrResearch(destination, country, { priority, forceRefresh: true })
}

export const DestinationFactsStore = { get, findRow, save, getOrResearch, refresh, isStale }

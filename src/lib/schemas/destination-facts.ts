/**
 * DestinationFacts — runtime-validated schema for the STABLE baseline facts a
 * destination has, established by the destination-research stage (stage 1).
 *
 * This is deliberately small and only holds STABLE facts (currency, driving
 * side, languages, broad transport modes, broad geography). Volatile
 * information (current prices, opening hours, current weather, current taxi
 * fares, SIM prices, transport operator changes) does NOT belong here — those
 * are handled by the later claim / current-information verification pipeline.
 *
 * Every DestinationFacts object must be traceable back to the research used to
 * establish it, so `sources` is required and must be non-empty.
 */
import { z } from 'zod'

// ─── Source provenance ─────────────────────────────────────────────────────

export const SOURCE_TYPES = [
  'government',
  'tourism_authority',
  'transport_operator',
  'official',
  'reputable_reference',
  'other',
] as const

export type SourceType = (typeof SOURCE_TYPES)[number]

export const SourceSchema = z.object({
  url: z.string(),
  title: z.string(),
  sourceType: z.enum(SOURCE_TYPES),
})

export type Source = z.infer<typeof SourceSchema>

// ─── Sub-schemas ────────────────────────────────────────────────────────────

export const DRIVING_SIDES = ['left', 'right', 'unknown'] as const
export type DrivingSide = (typeof DRIVING_SIDES)[number]

export const CurrencySchema = z.object({
  code: z.string(), // ISO 4217 where known, e.g. "THB"
  name: z.string(), // e.g. "Thai Baht"
})

export const TransportSchema = z.object({
  // `null` explicitly represents "unknown / not established" so the research
  // stage never has to turn "not found" into "does not exist" (false).
  bus: z.boolean().nullable(),
  train: z.boolean().nullable(),
  tram: z.boolean().nullable(),
  metro: z.boolean().nullable(),
  taxi: z.boolean().nullable(),
  // Ride-hailing brands actually established to operate (e.g. ["Grab", "Bolt"]).
  // Empty array = none established (not "none exist").
  rideHailing: z.array(z.string()),
})

export const GeographySchema = z.object({
  type: z.string().nullable(), // e.g. "island", "coastal city", null when unknown
  majorAreas: z.array(z.string()), // e.g. ["Patong", "Kata", "Phuket Town"]
})

// ─── DestinationFacts ─────────────────────────────────────────────────────────

export const DestinationFactsSchema = z.object({
  destination: z.string(),
  country: z.string(),
  currency: CurrencySchema,
  drivingSide: z.enum(DRIVING_SIDES),
  languages: z.array(z.string()),
  transport: TransportSchema,
  geography: GeographySchema,
  /** Research provenance — must never be empty (facts must be traceable). */
  sources: z.array(SourceSchema).min(1),
})

export type DestinationFacts = z.infer<typeof DestinationFactsSchema>
export type Currency = z.infer<typeof CurrencySchema>
export type Transport = z.infer<typeof TransportSchema>
export type Geography = z.infer<typeof GeographySchema>

/**
 * The shape the research MODEL is asked to return. It excludes `sources`
 * (which the application attaches from the actual retrieved web sources rather
 * than trusting the model to echo them) so we never fabricate provenance.
 */
export const ResearchedFactsSchema = DestinationFactsSchema.omit({ sources: true })
export type ResearchedFacts = z.infer<typeof ResearchedFactsSchema>

/**
 * Validate an unknown value as DestinationFacts. Throws a ZodError on failure.
 */
export function parseDestinationFacts(value: unknown): DestinationFacts {
  return DestinationFactsSchema.parse(value)
}

/** Safe variant — returns a discriminated result instead of throwing. */
export function safeParseDestinationFacts(value: unknown) {
  return DestinationFactsSchema.safeParse(value)
}

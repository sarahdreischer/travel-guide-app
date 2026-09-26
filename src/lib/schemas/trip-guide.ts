/**
 * TripGuide — runtime-validated schema for the STRUCTURED output of the
 * trip-guide generation stage (stage 2).
 *
 * This is the personalised guidance for one traveller's trip, produced using
 * the researched DestinationFacts as baseline factual context. Every
 * externally verifiable factual statement is represented in `claims[]` and is
 * prepared (but NOT yet executed) for the future verification pipeline.
 *
 * Terminology note (per the migration):
 *  - "category" is now "topic"
 *  - "sub-question" is now "question"
 */
import { z } from 'zod'

// ─── Claim ──────────────────────────────────────────────────────────────────

export const CLAIM_TYPES = [
  'stable_fact',
  'current_fact',
  'price',
  'named_entity',
  'transport',
  'opening_hours',
  'weather',
  'health',
  'visa',
  'legal',
  'safety',
  'connectivity',
  'geography',
  'other',
] as const

export const RISK_LEVELS = ['low', 'medium', 'high'] as const
export const VOLATILITY_LEVELS = ['stable', 'seasonal', 'volatile'] as const
export const VERIFICATION_STATUSES = ['not_checked', 'needs_verification'] as const

export const ClaimSchema = z.object({
  claim: z.string(),
  type: z.enum(CLAIM_TYPES),
  risk: z.enum(RISK_LEVELS),
  volatility: z.enum(VOLATILITY_LEVELS),
  verificationRequired: z.boolean(),
  requiresAuthoritativeSource: z.boolean(),
  verificationStatus: z.enum(VERIFICATION_STATUSES),
})

export type Claim = z.infer<typeof ClaimSchema>

// ─── Entity ─────────────────────────────────────────────────────────────────

export const ENTITY_TYPES = [
  'hotel',
  'hostel',
  'holiday_rental',
  'restaurant',
  'bar',
  'attraction',
  'tour_operator',
  'transport_provider',
  'neighbourhood',
  'beach',
  'other',
] as const

export const EntitySchema = z.object({
  name: z.string(),
  entityType: z.enum(ENTITY_TYPES),
})

export type Entity = z.infer<typeof EntitySchema>

// ─── GuideItem ────────────────────────────────────────────────────────────────

export const PRIORITIES = ['high', 'medium', 'low'] as const

export const GuideItemSchema = z.object({
  questionId: z.string(),
  priority: z.enum(PRIORITIES),
  applicability: z.string(),
  recommendation: z.string().nullable(),
  why: z.string().nullable(),
  answer: z.string().nullable(),
  entities: z.array(EntitySchema),
  claims: z.array(ClaimSchema),
  actions: z.array(z.string()),
})

export type GuideItem = z.infer<typeof GuideItemSchema>

// ─── Topic ────────────────────────────────────────────────────────────────────

export const TopicSummarySchema = z.object({
  headline: z.string(),
  recommendation: z.string(),
})

export const TopicSchema = z.object({
  topicId: z.string(),
  summary: TopicSummarySchema,
  items: z.array(GuideItemSchema),
})

export type Topic = z.infer<typeof TopicSchema>

// ─── TripGuide ────────────────────────────────────────────────────────────────

export const TripSummarySchema = z.object({
  destination: z.string(),
  country: z.string(),
  nights: z.number(),
  travellerType: z.string(),
  travelStyles: z.array(z.string()),
})

export const TripGuideSchema = z.object({
  tripSummary: TripSummarySchema,
  topics: z.array(TopicSchema),
})

export type TripGuide = z.infer<typeof TripGuideSchema>
export type TripSummary = z.infer<typeof TripSummarySchema>

/**
 * Validate an unknown value as a TripGuide. Throws a ZodError on failure.
 */
export function parseTripGuide(value: unknown): TripGuide {
  return TripGuideSchema.parse(value)
}

/** Safe variant — returns a discriminated result instead of throwing. */
export function safeParseTripGuide(value: unknown) {
  return TripGuideSchema.safeParse(value)
}

// ─── Invariants shared by generator + verification prep ────────────────────────

/**
 * High-risk claim types that MUST be treated as high risk, verification
 * required, and require an authoritative source. Used both to instruct the
 * model and to normalise its output defensively after generation.
 */
export const HIGH_RISK_CLAIM_TYPES: ReadonlyArray<(typeof CLAIM_TYPES)[number]> = [
  'visa',
  'health',
  'legal',
  'safety',
]

/**
 * Claim types that are inherently volatile and must at least require
 * verification (prices, opening hours, current transport/availability, etc.).
 */
export const VERIFY_REQUIRED_CLAIM_TYPES: ReadonlyArray<(typeof CLAIM_TYPES)[number]> = [
  'price',
  'opening_hours',
  'current_fact',
  'weather',
  'connectivity',
]

/**
 * Defensively normalise a claim so the risk/verification invariants hold
 * regardless of what the model emitted. This does NOT verify the claim — it
 * only ensures the metadata is internally consistent for the future pipeline.
 */
export function normaliseClaim(claim: Claim): Claim {
  const next: Claim = { ...claim }

  if (HIGH_RISK_CLAIM_TYPES.includes(next.type)) {
    next.risk = 'high'
    next.verificationRequired = true
    next.requiresAuthoritativeSource = true
  }

  if (VERIFY_REQUIRED_CLAIM_TYPES.includes(next.type)) {
    next.verificationRequired = true
    if (next.volatility === 'stable') next.volatility = 'volatile'
  }

  // A claim that requires an authoritative source must also require verification.
  if (next.requiresAuthoritativeSource) next.verificationRequired = true

  // Anything requiring verification but left as "not_checked" should surface as
  // needing verification for the future pipeline.
  if (next.verificationRequired && next.verificationStatus === 'not_checked') {
    next.verificationStatus = 'needs_verification'
  }

  return next
}

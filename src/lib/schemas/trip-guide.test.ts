import {
  TripGuideSchema,
  parseTripGuide,
  safeParseTripGuide,
  normaliseClaim,
  type TripGuide,
  type Claim,
} from '@/lib/schemas/trip-guide'

function baseClaim(overrides: Partial<Claim> = {}): Claim {
  return {
    claim: 'Grab operates in Phuket.',
    type: 'transport',
    risk: 'low',
    volatility: 'volatile',
    verificationRequired: false,
    requiresAuthoritativeSource: false,
    verificationStatus: 'not_checked',
    ...overrides,
  }
}

function validGuide(): TripGuide {
  return {
    tripSummary: {
      destination: 'Phuket',
      country: 'Thailand',
      nights: 14,
      travellerType: 'couple',
      travelStyles: ['adventure', 'relaxed'],
    },
    topics: [
      {
        topicId: 'transport',
        summary: { headline: 'Getting around Phuket', recommendation: 'Use Grab and taxis.' },
        items: [
          {
            questionId: 'transport.ride_hailing.availability',
            priority: 'high',
            applicability: 'Relevant for a couple without a car.',
            recommendation: 'Use Grab for most trips.',
            why: 'Cheaper and safer than negotiating taxi fares.',
            answer: null,
            entities: [{ name: 'Grab', entityType: 'transport_provider' }],
            claims: [baseClaim()],
            actions: ['Install the Grab app before arrival.'],
          },
        ],
      },
    ],
  }
}

describe('TripGuideSchema', () => {
  it('accepts a well-formed guide', () => {
    expect(() => parseTripGuide(validGuide())).not.toThrow()
  })

  it('rejects an invalid claim type', () => {
    const guide = validGuide()
    // @ts-expect-error — intentional invalid value
    guide.topics[0].items[0].claims[0].type = 'rumour'
    expect(safeParseTripGuide(guide).success).toBe(false)
  })

  it('rejects an invalid entity type', () => {
    const guide = validGuide()
    // @ts-expect-error — intentional invalid value
    guide.topics[0].items[0].entities[0].entityType = 'spaceship'
    expect(safeParseTripGuide(guide).success).toBe(false)
  })

  it('allows null recommendation/why/answer', () => {
    const guide = validGuide()
    guide.topics[0].items[0].recommendation = null
    guide.topics[0].items[0].why = null
    guide.topics[0].items[0].answer = null
    expect(safeParseTripGuide(guide).success).toBe(true)
  })
})

describe('normaliseClaim', () => {
  it('forces health claims to high risk + verification required + authoritative source', () => {
    const c = normaliseClaim(baseClaim({ type: 'health', risk: 'low', verificationRequired: false, requiresAuthoritativeSource: false }))
    expect(c.risk).toBe('high')
    expect(c.verificationRequired).toBe(true)
    expect(c.requiresAuthoritativeSource).toBe(true)
    expect(c.verificationStatus).toBe('needs_verification')
  })

  it('forces safety/visa/legal claims to high risk', () => {
    for (const type of ['safety', 'visa', 'legal'] as const) {
      const c = normaliseClaim(baseClaim({ type }))
      expect(c.risk).toBe('high')
      expect(c.verificationRequired).toBe(true)
      expect(c.requiresAuthoritativeSource).toBe(true)
    }
  })

  it('marks volatile claim types (price, opening_hours) as verification required', () => {
    const price = normaliseClaim(baseClaim({ type: 'price', volatility: 'stable', verificationRequired: false }))
    expect(price.verificationRequired).toBe(true)
    expect(price.volatility).toBe('volatile')
    expect(price.verificationStatus).toBe('needs_verification')
  })

  it('leaves a low-risk stable_fact untouched', () => {
    const c = normaliseClaim(baseClaim({ type: 'stable_fact', risk: 'low', volatility: 'stable', verificationRequired: false }))
    expect(c.risk).toBe('low')
    expect(c.verificationRequired).toBe(false)
    expect(c.verificationStatus).toBe('not_checked')
  })
})

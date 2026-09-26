import { selectRelevantQuestions, generateTripGuide, type TripGuideInput } from '@/lib/trip-guide-generator'
import type { DestinationFacts } from '@/lib/schemas/destination-facts'
import type { TripGuide } from '@/lib/schemas/trip-guide'

jest.mock('ai', () => ({ generateObject: jest.fn() }))
jest.mock('@ai-sdk/openai', () => ({ openai: jest.fn(() => ({ id: 'mock-model' })) }))
jest.mock('@/lib/ai-rate-limiter', () => ({
  canCallAI: jest.fn(() => true),
  recordAICall: jest.fn(),
  recordAIFailure: jest.fn(),
  getRateLimitStatus: jest.fn(() => ({ minuteCount: 0, maxPerMinute: 3, dayCount: 0, maxPerDay: 50, inCooldown: false, cooldownRemainingSeconds: 0 })),
}))

import { generateObject } from 'ai'
const mockGenerateObject = generateObject as jest.Mock

function phuketFacts(overrides: Partial<DestinationFacts['transport']> = {}): DestinationFacts {
  return {
    destination: 'Phuket',
    country: 'Thailand',
    currency: { code: 'THB', name: 'Thai Baht' },
    drivingSide: 'left',
    languages: ['Thai'],
    transport: {
      bus: true,
      train: false, // Phuket has no passenger rail
      tram: false,
      metro: false,
      taxi: true,
      rideHailing: ['Grab'],
      ...overrides,
    },
    geography: { type: 'island', majorAreas: ['Patong', 'Kata'] },
    sources: [{ url: 'https://en.wikipedia.org/wiki/Phuket', title: 'Phuket', sourceType: 'reputable_reference' }],
  }
}

const phuketTrip: TripGuideInput = {
  destination: 'Phuket',
  country: 'Thailand',
  nights: 14,
  travellerType: 'couple',
  travelStyles: ['adventure', 'relaxed'],
  transportMode: 'fly',
  startingLocation: 'Germany',
  totalBudgetUsd: 3500,
  transportCostIncluded: true,
  activities: [],
}

describe('selectRelevantQuestions', () => {
  it('excludes train/metro/tram questions when the facts establish they are absent (false)', () => {
    const qs = selectRelevantQuestions(phuketFacts(), phuketTrip)
    const ids = qs.map((q) => q.id)
    expect(ids).not.toContain('transport.train.available')
    expect(ids).not.toContain('transport.metro.available')
    expect(ids).not.toContain('transport.tram.available')
  })

  it('keeps transport-gated questions when the fact is unknown (null) — not-found is not does-not-exist', () => {
    const qs = selectRelevantQuestions(phuketFacts({ train: null, metro: null, tram: null }), phuketTrip)
    const ids = qs.map((q) => q.id)
    expect(ids).toContain('transport.train.available')
    expect(ids).toContain('transport.metro.available')
  })

  it('excludes trip-transport-mode-gated questions that do not match the trip mode', () => {
    // A flying couple should not be offered the driving-licence question.
    const qs = selectRelevantQuestions(phuketFacts(), phuketTrip)
    expect(qs.map((q) => q.id)).not.toContain('transport.driving.licence')
  })

  it('keeps the airport-transfer question for a flying trip', () => {
    const qs = selectRelevantQuestions(phuketFacts(), phuketTrip)
    expect(qs.map((q) => q.id)).toContain('transport.airport.transfer')
  })
})

describe('generateTripGuide', () => {
  beforeEach(() => jest.clearAllMocks())

  it('generates a validated guide and normalises high-risk/volatile claims', async () => {
    const modelGuide: TripGuide = {
      tripSummary: {
        destination: 'Phuket',
        country: 'Thailand',
        nights: 14,
        travellerType: 'couple',
        travelStyles: ['adventure', 'relaxed'],
      },
      topics: [
        {
          topicId: 'health',
          summary: { headline: 'Health & safety', recommendation: 'Check vaccinations early.' },
          items: [
            {
              questionId: 'health.vaccinations',
              priority: 'high',
              applicability: 'Relevant travelling from Germany.',
              recommendation: 'Confirm routine vaccinations.',
              why: 'Requirements vary by origin.',
              answer: null,
              entities: [],
              // Model under-marked this health claim — normalisation must fix it.
              claims: [
                {
                  claim: 'Hepatitis A vaccination is recommended for Thailand.',
                  type: 'health',
                  risk: 'low',
                  volatility: 'stable',
                  verificationRequired: false,
                  requiresAuthoritativeSource: false,
                  verificationStatus: 'not_checked',
                },
              ],
              actions: ['See a travel clinic 4-6 weeks before departure.'],
            },
          ],
        },
      ],
    }

    mockGenerateObject.mockResolvedValue({ object: modelGuide })

    const guide = await generateTripGuide({ trip: phuketTrip, facts: phuketFacts() })

    // tripSummary reflects the actual trip inputs.
    expect(guide.tripSummary.nights).toBe(14)
    expect(guide.tripSummary.travellerType).toBe('couple')
    expect(guide.tripSummary.travelStyles).toEqual(['adventure', 'relaxed'])

    // The health claim was normalised to high risk + verification required.
    const claim = guide.topics[0].items[0].claims[0]
    expect(claim.risk).toBe('high')
    expect(claim.verificationRequired).toBe(true)
    expect(claim.requiresAuthoritativeSource).toBe(true)
    expect(claim.verificationStatus).toBe('needs_verification')
  })

  it('passes the relevant question set (excluding trains) into the model prompt', async () => {
    mockGenerateObject.mockResolvedValue({
      object: {
        tripSummary: { destination: 'Phuket', country: 'Thailand', nights: 14, travellerType: 'couple', travelStyles: ['adventure', 'relaxed'] },
        topics: [],
      },
    })

    await generateTripGuide({ trip: phuketTrip, facts: phuketFacts() })

    const prompt = mockGenerateObject.mock.calls[0][0].prompt as string
    expect(prompt).not.toContain('transport.train.available')
    expect(prompt).toContain('transport.ride_hailing.availability')
    // Uses the actual budget.
    expect(prompt).toContain('3,500')
  })
})

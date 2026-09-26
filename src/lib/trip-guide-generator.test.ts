import { selectRelevantQuestions, generateTripGuide, type TripGuideInput } from '@/lib/trip-guide-generator'
import type { DestinationFacts } from '@/lib/schemas/destination-facts'

jest.mock('ai', () => ({ generateObject: jest.fn() }))
jest.mock('@ai-sdk/openai', () => ({ openai: jest.fn(() => ({ id: 'mock-model' })) }))
jest.mock('@/lib/ai-rate-limiter', () => ({
  canCallAI: jest.fn(() => true),
  recordAICall: jest.fn(),
  recordAIFailure: jest.fn(),
  getRateLimitStatus: jest.fn(() => ({ minuteCount: 0, maxPerMinute: 3, dayCount: 0, maxPerDay: 50, inCooldown: false, cooldownRemainingSeconds: 0 })),
}))

import { generateObject } from 'ai'
import { recordAICall, recordAIFailure } from '@/lib/ai-rate-limiter'
import { AdviceTimeoutError } from '@/lib/ai-errors'
const mockGenerateObject = generateObject as jest.Mock
const mockRecordAIFailure = recordAIFailure as jest.Mock
const mockRecordAICall = recordAICall as jest.Mock

// A minimal valid per-topic response ({ summary, items }) the generator now
// expects from each generateObject call.
function topicResponse(topicId: string, questionId: string, extra: Record<string, unknown> = {}) {
  return {
    object: {
      summary: { headline: `${topicId} headline`, recommendation: `${topicId} rec` },
      items: [
        {
          questionId,
          priority: 'high',
          applicability: 'relevant',
          recommendation: 'do this',
          why: 'because',
          answer: null,
          entities: [],
          claims: [],
          actions: [],
          ...extra,
        },
      ],
    },
  }
}

// A "content failure" like the SDK's NoObjectGeneratedError (name-based; the
// generator's classifier treats non-provider errors as content failures).
function contentFailure() {
  const e = new Error('No object generated: response did not match schema.')
  e.name = 'AI_NoObjectGeneratedError'
  return e
}

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

describe('generateTripGuide (per-topic)', () => {
  beforeEach(() => jest.clearAllMocks())

  it('generates one object per topic, assembles them, and normalises high-risk claims', async () => {
    // Each generateObject call returns that topic's {summary, items}. Return a
    // health topic with an under-marked health claim so normalisation is tested.
    mockGenerateObject.mockImplementation(async (args: { prompt: string }) => {
      const prompt = args.prompt
      if (prompt.includes('SINGLE topic: "health"')) {
        return {
          object: {
            summary: { headline: 'Health & safety', recommendation: 'Sort vaccinations early.' },
            items: [
              {
                questionId: 'health.vaccinations',
                priority: 'high',
                applicability: 'Travelling from Germany.',
                recommendation: 'Confirm routine vaccinations.',
                why: 'Requirements vary by origin.',
                answer: null,
                entities: [],
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
        }
      }
      // Every other topic returns a single generic item.
      const idMatch = prompt.match(/SINGLE topic: "([^"]+)"/)
      const topicId = idMatch?.[1] ?? 'transport'
      return topicResponse(topicId, `${topicId}.x`)
    })

    const { guide, meta } = await generateTripGuide({ trip: phuketTrip, facts: phuketFacts() })

    // One generateObject call per relevant topic.
    const topicCount = new Set(
      selectRelevantQuestions(phuketFacts(), phuketTrip).map((q) => q.topicId)
    ).size
    expect(mockGenerateObject).toHaveBeenCalledTimes(topicCount)

    // tripSummary reflects the actual trip inputs.
    expect(guide.tripSummary.nights).toBe(14)
    expect(guide.tripSummary.travellerType).toBe('couple')
    expect(guide.tripSummary.travelStyles).toEqual(['adventure', 'relaxed'])

    // All topics produced → complete, no failures.
    expect(meta.complete).toBe(true)
    expect(meta.failedTopicIds).toEqual([])
    expect(meta.resolvedTopicIds.length).toBe(topicCount)

    // The health claim was normalised to high risk + verification required.
    const healthTopic = guide.topics.find((t) => t.topicId === 'health')!
    const claim = healthTopic.items[0].claims[0]
    expect(claim.risk).toBe('high')
    expect(claim.verificationRequired).toBe(true)
    expect(claim.requiresAuthoritativeSource).toBe(true)
    expect(claim.verificationStatus).toBe('needs_verification')
  })

  it('scopes each prompt to a single topic, excludes train questions, and uses the actual budget', async () => {
    mockGenerateObject.mockImplementation(async (args: { prompt: string }) => {
      const topicId = args.prompt.match(/SINGLE topic: "([^"]+)"/)?.[1] ?? 'transport'
      return topicResponse(topicId, `${topicId}.x`)
    })

    await generateTripGuide({ trip: phuketTrip, facts: phuketFacts() })

    const prompts = mockGenerateObject.mock.calls.map((c) => c[0].prompt as string)
    // No prompt offers the train question (facts say train=false).
    expect(prompts.some((p) => p.includes('transport.train.available'))).toBe(false)
    // The transport prompt offers ride-hailing and every prompt carries the budget.
    const transportPrompt = prompts.find((p) => p.includes('SINGLE topic: "transport"'))!
    expect(transportPrompt).toContain('transport.ride_hailing.availability')
    expect(transportPrompt).toContain('3,500')
  })

  it('instructs the model to give concrete content (not meta-advice) in the answer', async () => {
    mockGenerateObject.mockImplementation(async (args: { prompt: string }) => {
      const topicId = args.prompt.match(/SINGLE topic: "([^"]+)"/)?.[1] ?? 'culture'
      return topicResponse(topicId, `${topicId}.x`)
    })

    await generateTripGuide({ trip: phuketTrip, facts: phuketFacts() })

    const prompt = mockGenerateObject.mock.calls[0][0].prompt as string
    // The anti-generic guardrail is present: demands actual content and bans
    // the "learn basic greetings" meta-advice failure mode.
    expect(prompt).toContain('BE CONCRETE')
    expect(prompt).toContain('learn basic')
    expect(prompt).toMatch(/pronunciation/i)
  })

  it('returns a PARTIAL guide when one topic content-fails but others succeed', async () => {
    let call = 0
    mockGenerateObject.mockImplementation(async (args: { prompt: string }) => {
      call++
      const topicId = args.prompt.match(/SINGLE topic: "([^"]+)"/)?.[1] ?? 'transport'
      // Fail the first topic with a content (schema) failure; succeed the rest.
      if (call === 1) throw contentFailure()
      return topicResponse(topicId, `${topicId}.x`)
    })

    const { guide, meta } = await generateTripGuide({ trip: phuketTrip, facts: phuketFacts() })

    // Guide still produced (minus the failed topic).
    expect(guide.topics.length).toBeGreaterThan(0)
    // The failed topic is recorded and the guide is marked incomplete so it can
    // be reconciled on a later view.
    expect(meta.failedTopicIds.length).toBe(1)
    expect(meta.complete).toBe(false)
    // The failed topic is NOT in the resolved (terminal) set.
    expect(meta.resolvedTopicIds).not.toContain(meta.failedTopicIds[0])
    // Content failure must NOT trip the provider cooldown.
    expect(mockRecordAIFailure).not.toHaveBeenCalled()
  })

  it('records an intentionally-empty topic as resolved (not failed) and stays complete', async () => {
    // The first topic returns zero items on purpose; the rest produce items.
    let call = 0
    mockGenerateObject.mockImplementation(async (args: { prompt: string }) => {
      call++
      const topicId = args.prompt.match(/SINGLE topic: "([^"]+)"/)?.[1] ?? 'transport'
      if (call === 1) {
        return { object: { summary: { headline: 'h', recommendation: 'r' }, items: [] } }
      }
      return topicResponse(topicId, `${topicId}.x`)
    })

    const { meta } = await generateTripGuide({ trip: phuketTrip, facts: phuketFacts() })

    expect(meta.emptyTopicIds.length).toBe(1)
    expect(meta.failedTopicIds).toEqual([])
    expect(meta.complete).toBe(true)
    // The empty topic counts as resolved, so it is never retried later.
    expect(meta.resolvedTopicIds).toContain(meta.emptyTopicIds[0])
  })

  it('regenerates ONLY the requested subset of topics when topicIds is provided', async () => {
    mockGenerateObject.mockImplementation(async (args: { prompt: string }) => {
      const topicId = args.prompt.match(/SINGLE topic: "([^"]+)"/)?.[1] ?? 'transport'
      return topicResponse(topicId, `${topicId}.x`)
    })

    const { guide, meta } = await generateTripGuide({
      trip: phuketTrip,
      facts: phuketFacts(),
      topicIds: ['health'],
    })

    // Exactly one call, for the health topic only.
    expect(mockGenerateObject).toHaveBeenCalledTimes(1)
    const prompt = mockGenerateObject.mock.calls[0][0].prompt as string
    expect(prompt).toContain('SINGLE topic: "health"')
    expect(meta.attemptedTopicIds).toEqual(['health'])
    expect(guide.topics.map((t) => t.topicId)).toEqual(['health'])
  })

  it('does NOT record a provider failure (no cooldown) when ALL topics content-fail; throws AdviceTimeoutError', async () => {
    mockGenerateObject.mockRejectedValue(contentFailure())

    await expect(generateTripGuide({ trip: phuketTrip, facts: phuketFacts() })).rejects.toBeInstanceOf(
      AdviceTimeoutError
    )
    // Crucially: a schema mismatch is a content failure, so the cooldown is
    // never triggered (this was the production bug).
    expect(mockRecordAIFailure).not.toHaveBeenCalled()
    // A call was still recorded per attempt.
    expect(mockRecordAICall).toHaveBeenCalled()
  })

  it('records a provider failure (cooldown) and stops early on a transport error', async () => {
    const timeout = new Error('The operation was aborted')
    timeout.name = 'TimeoutError'
    let call = 0
    mockGenerateObject.mockImplementation(async (args: { prompt: string }) => {
      call++
      if (call === 1) throw timeout // provider failure on the first topic
      const topicId = args.prompt.match(/SINGLE topic: "([^"]+)"/)?.[1] ?? 'transport'
      return topicResponse(topicId, `${topicId}.x`)
    })

    await expect(generateTripGuide({ trip: phuketTrip, facts: phuketFacts() })).rejects.toBeInstanceOf(
      AdviceTimeoutError
    )
    // Provider failure DID trip the cooldown, and we stopped after the first call.
    expect(mockRecordAIFailure).toHaveBeenCalledTimes(1)
    expect(mockGenerateObject).toHaveBeenCalledTimes(1)
  })
})

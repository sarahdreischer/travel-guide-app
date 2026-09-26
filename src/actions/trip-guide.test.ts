import { getOrGenerateTripGuideAction, type TripGuideRequest } from '@/actions/trip-guide'
import { DestinationFactsStore } from '@/lib/destination-facts-store'
import { TripGuideStore } from '@/lib/trip-guide-store'
import { generateTripGuide } from '@/lib/trip-guide-generator'
import type { DestinationFacts } from '@/lib/schemas/destination-facts'
import type { TripGuide } from '@/lib/schemas/trip-guide'
import type { GuideGenerationMeta } from '@/lib/trip-guide-generator'

jest.mock('@/lib/destination-facts-store', () => ({
  DestinationFactsStore: {
    get: jest.fn(),
    findRow: jest.fn(),
    getOrResearch: jest.fn(),
  },
}))
jest.mock('@/lib/trip-guide-store', () => ({
  TripGuideStore: {
    get: jest.fn(),
    getRecord: jest.fn(),
    save: jest.fn(),
    // Real merge behaviour so reconciliation assertions are meaningful.
    mergeTopics: (base: TripGuide, fresh: TripGuide['topics']): TripGuide => {
      const byId = new Map(fresh.map((t) => [t.topicId, t]))
      const merged = base.topics.map((t) => byId.get(t.topicId) ?? t)
      const ids = new Set(base.topics.map((t) => t.topicId))
      for (const t of fresh) if (!ids.has(t.topicId)) merged.push(t)
      return { tripSummary: base.tripSummary, topics: merged }
    },
  },
}))
jest.mock('@/lib/trip-guide-generator', () => {
  const actual = jest.requireActual('@/lib/trip-guide-generator')
  return {
    generateTripGuide: jest.fn(),
    // Use the real relevantTopicIds so reconciliation computes the true set.
    relevantTopicIds: actual.relevantTopicIds,
  }
})

const facts: DestinationFacts = {
  destination: 'Phuket',
  country: 'Thailand',
  currency: { code: 'THB', name: 'Thai Baht' },
  drivingSide: 'left',
  languages: ['Thai'],
  transport: { bus: true, train: false, tram: false, metro: false, taxi: true, rideHailing: ['Grab'] },
  geography: { type: 'island', majorAreas: ['Patong', 'Kata'] },
  sources: [{ url: 'https://en.wikipedia.org/wiki/Phuket', title: 'Phuket', sourceType: 'reputable_reference' }],
}

function topic(topicId: string, questionId: string): TripGuide['topics'][number] {
  return {
    topicId,
    summary: { headline: `${topicId} h`, recommendation: `${topicId} r` },
    items: [
      {
        questionId,
        priority: 'high',
        applicability: 'x',
        recommendation: 'do',
        why: 'because',
        answer: null,
        entities: topicId === 'transport' ? [{ name: 'Grab', entityType: 'transport_provider' }] : [],
        claims: [],
        actions: [],
      },
    ],
  }
}

const guide: TripGuide = {
  tripSummary: { destination: 'Phuket', country: 'Thailand', nights: 14, travellerType: 'couple', travelStyles: ['adventure', 'relaxed'] },
  topics: [topic('transport', 'transport.ride_hailing.availability')],
}

function meta(overrides: Partial<GuideGenerationMeta> = {}): GuideGenerationMeta {
  return {
    attemptedTopicIds: ['transport'],
    producedTopicIds: ['transport'],
    emptyTopicIds: [],
    failedTopicIds: [],
    resolvedTopicIds: ['transport'],
    providerShortCircuited: false,
    complete: true,
    ...overrides,
  }
}

const phuketRequest: TripGuideRequest = {
  destination: 'Phuket, Thailand',
  startDate: '2026-11-01',
  endDate: '2026-11-15',
  travellerType: 'Couple',
  budgetUsd: 3500,
  transportMode: 'fly',
  startingLocation: 'Germany',
  transportCostIncluded: true,
  activities: [],
  travelStyle: 'Adventure, Relaxed',
}

describe('getOrGenerateTripGuideAction (Phuket flow)', () => {
  beforeEach(() => jest.clearAllMocks())

  it('researches facts, feeds them into generation, persists with completeness metadata, cached=false', async () => {
    ;(TripGuideStore.getRecord as jest.Mock).mockResolvedValue(null)
    ;(DestinationFactsStore.getOrResearch as jest.Mock).mockResolvedValue(facts)
    ;(DestinationFactsStore.findRow as jest.Mock).mockResolvedValue({ id: 'facts-row-1' })
    ;(generateTripGuide as jest.Mock).mockResolvedValue({ guide, meta: meta() })
    ;(TripGuideStore.save as jest.Mock).mockImplementation(async (_k, g) => g)

    const result = await getOrGenerateTripGuideAction(phuketRequest)

    expect(result.status).toBe('success')
    if (result.status !== 'success') return
    expect(result.cached).toBe(false)

    expect(DestinationFactsStore.getOrResearch).toHaveBeenCalledWith('Phuket', 'Thailand', expect.any(Object))

    const genArg = (generateTripGuide as jest.Mock).mock.calls[0][0]
    expect(genArg.facts).toBe(facts)
    expect(genArg.trip.nights).toBe(14)
    expect(genArg.trip.travellerType).toBe('couple')
    expect(genArg.trip.totalBudgetUsd).toBe(3500)

    // Persisted with completeness metadata.
    const saveArgs = (TripGuideStore.save as jest.Mock).mock.calls[0]
    expect(saveArgs[1]).toBe(guide)
    expect(saveArgs[2]).toEqual(
      expect.objectContaining({ destinationFactsId: 'facts-row-1', complete: true, attemptedTopics: ['transport'] })
    )
  })

  it('reuses a COMPLETE cached guide without researching or regenerating', async () => {
    ;(TripGuideStore.getRecord as jest.Mock).mockResolvedValue({ guide, complete: true, attemptedTopics: null })
    ;(DestinationFactsStore.get as jest.Mock).mockResolvedValue(facts)

    const result = await getOrGenerateTripGuideAction(phuketRequest)

    expect(result.status).toBe('success')
    if (result.status !== 'success') return
    expect(result.cached).toBe(true)
    expect(generateTripGuide).not.toHaveBeenCalled()
    expect(DestinationFactsStore.getOrResearch).not.toHaveBeenCalled()
  })

  it('reconciles an INCOMPLETE cached guide by regenerating ONLY the missing topics and merging', async () => {
    // Cached guide has transport, but "health" is relevant and unresolved.
    ;(TripGuideStore.getRecord as jest.Mock).mockResolvedValue({
      guide,
      complete: false,
      attemptedTopics: ['transport'], // resolved so far
    })
    ;(DestinationFactsStore.get as jest.Mock).mockResolvedValue(facts)
    ;(DestinationFactsStore.findRow as jest.Mock).mockResolvedValue({ id: 'facts-row-1' })

    const healthTopic = topic('health', 'health.vaccinations')
    ;(generateTripGuide as jest.Mock).mockResolvedValue({
      guide: { tripSummary: guide.tripSummary, topics: [healthTopic] },
      meta: meta({
        attemptedTopicIds: ['health'],
        producedTopicIds: ['health'],
        resolvedTopicIds: ['health'],
      }),
    })
    ;(TripGuideStore.save as jest.Mock).mockImplementation(async (_k, g) => g)

    const result = await getOrGenerateTripGuideAction(phuketRequest)

    expect(result.status).toBe('success')
    if (result.status !== 'success') return
    expect(result.cached).toBe(true)

    // Only the missing topics were requested for regeneration (never transport,
    // which was already resolved).
    const genArg = (generateTripGuide as jest.Mock).mock.calls[0][0]
    expect(genArg.topicIds).toContain('health')
    expect(genArg.topicIds).not.toContain('transport')

    // Merged guide contains both the original and the reconciled topic.
    const savedGuide = (TripGuideStore.save as jest.Mock).mock.calls[0][1] as TripGuide
    expect(savedGuide.topics.map((t) => t.topicId)).toEqual(expect.arrayContaining(['transport', 'health']))
  })

  it('does not regenerate when an incomplete guide actually has all relevant topics resolved (marks complete)', async () => {
    // attemptedTopics already covers every relevant topic id → nothing missing.
    const relevant = jest.requireActual('@/lib/trip-guide-generator').relevantTopicIds(facts, {
      transportMode: 'fly',
    }) as string[]
    ;(TripGuideStore.getRecord as jest.Mock).mockResolvedValue({
      guide,
      complete: false,
      attemptedTopics: relevant,
    })
    ;(DestinationFactsStore.get as jest.Mock).mockResolvedValue(facts)
    ;(DestinationFactsStore.findRow as jest.Mock).mockResolvedValue({ id: 'facts-row-1' })
    ;(TripGuideStore.save as jest.Mock).mockImplementation(async (_k, g) => g)

    const result = await getOrGenerateTripGuideAction(phuketRequest)

    expect(result.status).toBe('success')
    // No AI call — it just flips the row to complete.
    expect(generateTripGuide).not.toHaveBeenCalled()
    const saveArgs = (TripGuideStore.save as jest.Mock).mock.calls[0]
    expect(saveArgs[2]).toEqual(expect.objectContaining({ complete: true }))
  })
})

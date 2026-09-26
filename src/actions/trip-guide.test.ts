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
    // Use the real selectors so reconciliation computes the true relevant sets.
    relevantTopicIds: actual.relevantTopicIds,
    relevantQuestionIds: actual.relevantQuestionIds,
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
    coveredQuestionIds: ['transport.ride_hailing.availability'],
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

// The true relevant topic/question sets for the Phuket fixture, via the real
// generator selectors — so "fully covered" fixtures don't falsely look stale.
const generatorActual = jest.requireActual('@/lib/trip-guide-generator')
function allRelevantTopics(): string[] {
  return generatorActual.relevantTopicIds(facts, { transportMode: 'fly' })
}
function allRelevantQuestions(): string[] {
  return generatorActual.relevantQuestionIds(facts, { transportMode: 'fly' })
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

    // Persisted with completeness + coverage metadata.
    const saveArgs = (TripGuideStore.save as jest.Mock).mock.calls[0]
    expect(saveArgs[1]).toBe(guide)
    expect(saveArgs[2]).toEqual(
      expect.objectContaining({
        destinationFactsId: 'facts-row-1',
        complete: true,
        attemptedTopics: ['transport'],
        coveredQuestions: ['transport.ride_hailing.availability'],
      })
    )
  })

  it('reuses a COMPLETE, fully-covered cached guide without researching or regenerating', async () => {
    // Covers every relevant question → no topic- or question-level staleness.
    ;(TripGuideStore.getRecord as jest.Mock).mockResolvedValue({
      guide,
      complete: true,
      attemptedTopics: allRelevantTopics(),
      coveredQuestions: allRelevantQuestions(),
    })
    ;(DestinationFactsStore.get as jest.Mock).mockResolvedValue(facts)

    const result = await getOrGenerateTripGuideAction(phuketRequest)

    expect(result.status).toBe('success')
    if (result.status !== 'success') return
    expect(result.cached).toBe(true)
    expect(generateTripGuide).not.toHaveBeenCalled()
    expect(DestinationFactsStore.getOrResearch).not.toHaveBeenCalled()
  })

  it('reconciles an INCOMPLETE cached guide by regenerating ONLY the missing topics and merging', async () => {
    // Fully covers questions (so no question-level staleness), but "health" is a
    // relevant topic that's unresolved → only the topic-level gap drives it.
    ;(TripGuideStore.getRecord as jest.Mock).mockResolvedValue({
      guide,
      complete: false,
      attemptedTopics: ['transport'],
      coveredQuestions: allRelevantQuestions(),
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
        coveredQuestionIds: ['health.vaccinations'],
      }),
    })
    ;(TripGuideStore.save as jest.Mock).mockImplementation(async (_k, g) => g)

    const result = await getOrGenerateTripGuideAction(phuketRequest)

    expect(result.status).toBe('success')
    if (result.status !== 'success') return
    expect(result.cached).toBe(true)

    const genArg = (generateTripGuide as jest.Mock).mock.calls[0][0]
    expect(genArg.topicIds).toContain('health')
    expect(genArg.topicIds).not.toContain('transport')

    const savedGuide = (TripGuideStore.save as jest.Mock).mock.calls[0][1] as TripGuide
    expect(savedGuide.topics.map((t) => t.topicId)).toEqual(expect.arrayContaining(['transport', 'health']))
  })

  it('refreshes a COMPLETE guide on open when a NEW question was added to the library — regenerating only that question\u2019s topic', async () => {
    // Complete + all topics resolved, but coveredQuestions is MISSING one
    // currently-relevant question (as if it was added to the library after the
    // guide was generated). Its topic must be regenerated.
    const newQuestionId = 'activities.beaches.waterTemperature'
    const relevantQs = allRelevantQuestions()
    // Guard: the scenario only makes sense if that question is currently relevant.
    expect(relevantQs).toContain(newQuestionId)
    const coveredWithout = relevantQs.filter((id) => id !== newQuestionId)

    ;(TripGuideStore.getRecord as jest.Mock).mockResolvedValue({
      guide,
      complete: true,
      attemptedTopics: allRelevantTopics(),
      coveredQuestions: coveredWithout,
    })
    ;(DestinationFactsStore.get as jest.Mock).mockResolvedValue(facts)
    ;(DestinationFactsStore.findRow as jest.Mock).mockResolvedValue({ id: 'facts-row-1' })

    const activitiesTopic = topic('activities', 'activities.recommendations')
    ;(generateTripGuide as jest.Mock).mockResolvedValue({
      guide: { tripSummary: guide.tripSummary, topics: [activitiesTopic] },
      meta: meta({
        attemptedTopicIds: ['activities'],
        producedTopicIds: ['activities'],
        resolvedTopicIds: ['activities'],
        coveredQuestionIds: ['activities.recommendations', 'activities.beaches.waterTemperature'],
      }),
    })
    ;(TripGuideStore.save as jest.Mock).mockImplementation(async (_k, g) => g)

    const result = await getOrGenerateTripGuideAction(phuketRequest)

    expect(result.status).toBe('success')
    if (result.status !== 'success') return
    expect(result.cached).toBe(true)

    // Only the new question's topic ("activities") was regenerated.
    const genArg = (generateTripGuide as jest.Mock).mock.calls[0][0]
    expect(genArg.topicIds).toEqual(['activities'])

    // The new question is now covered and the guide re-persisted.
    const saveArgs = (TripGuideStore.save as jest.Mock).mock.calls[0]
    expect(saveArgs[2].coveredQuestions).toContain('activities.beaches.waterTemperature')
  })

  it('does not regenerate when an incomplete guide is actually fully resolved + covered (marks complete)', async () => {
    ;(TripGuideStore.getRecord as jest.Mock).mockResolvedValue({
      guide,
      complete: false,
      attemptedTopics: allRelevantTopics(),
      coveredQuestions: allRelevantQuestions(),
    })
    ;(DestinationFactsStore.get as jest.Mock).mockResolvedValue(facts)
    ;(DestinationFactsStore.findRow as jest.Mock).mockResolvedValue({ id: 'facts-row-1' })
    ;(TripGuideStore.save as jest.Mock).mockImplementation(async (_k, g) => g)

    const result = await getOrGenerateTripGuideAction(phuketRequest)

    expect(result.status).toBe('success')
    expect(generateTripGuide).not.toHaveBeenCalled()
    const saveArgs = (TripGuideStore.save as jest.Mock).mock.calls[0]
    expect(saveArgs[2]).toEqual(expect.objectContaining({ complete: true }))
  })
})

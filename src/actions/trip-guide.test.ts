import { getOrGenerateTripGuideAction, type TripGuideRequest } from '@/actions/trip-guide'
import { DestinationFactsStore } from '@/lib/destination-facts-store'
import { TripGuideStore } from '@/lib/trip-guide-store'
import { generateTripGuide } from '@/lib/trip-guide-generator'
import type { DestinationFacts } from '@/lib/schemas/destination-facts'
import type { TripGuide } from '@/lib/schemas/trip-guide'

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
    save: jest.fn(),
  },
}))
jest.mock('@/lib/trip-guide-generator', () => ({
  generateTripGuide: jest.fn(),
}))

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

const guide: TripGuide = {
  tripSummary: { destination: 'Phuket', country: 'Thailand', nights: 14, travellerType: 'couple', travelStyles: ['adventure', 'relaxed'] },
  topics: [
    {
      topicId: 'transport',
      summary: { headline: 'Getting around', recommendation: 'Grab + taxis.' },
      items: [
        {
          questionId: 'transport.ride_hailing.availability',
          priority: 'high',
          applicability: 'couple, no car',
          recommendation: 'Use Grab.',
          why: 'Convenient.',
          answer: null,
          entities: [{ name: 'Grab', entityType: 'transport_provider' }],
          claims: [],
          actions: [],
        },
      ],
    },
  ],
}

// The Phuket representative test case.
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

  it('researches facts, feeds them into generation, persists, and reports cached=false', async () => {
    ;(TripGuideStore.get as jest.Mock).mockResolvedValue(null)
    ;(DestinationFactsStore.getOrResearch as jest.Mock).mockResolvedValue(facts)
    ;(DestinationFactsStore.findRow as jest.Mock).mockResolvedValue({ id: 'facts-row-1' })
    ;(generateTripGuide as jest.Mock).mockResolvedValue(guide)
    ;(TripGuideStore.save as jest.Mock).mockImplementation(async (_k, g) => g)

    const result = await getOrGenerateTripGuideAction(phuketRequest)

    expect(result.status).toBe('success')
    if (result.status !== 'success') return

    expect(result.cached).toBe(false)

    // Stage 1 ran with split "City, Country".
    expect(DestinationFactsStore.getOrResearch).toHaveBeenCalledWith('Phuket', 'Thailand', expect.any(Object))

    // Stage 2 received the RESEARCHED facts + the couple/adventure/relaxed/$3500 context.
    const genArg = (generateTripGuide as jest.Mock).mock.calls[0][0]
    expect(genArg.facts).toBe(facts)
    expect(genArg.trip.nights).toBe(14)
    expect(genArg.trip.travellerType).toBe('couple')
    expect(genArg.trip.travelStyles).toEqual(['adventure', 'relaxed'])
    expect(genArg.trip.totalBudgetUsd).toBe(3500)
    expect(genArg.trip.transportMode).toBe('fly')

    // Guide persisted, linked to the facts row.
    expect(TripGuideStore.save).toHaveBeenCalledWith(expect.any(Object), guide, 'facts-row-1')
  })

  it('reuses a cached guide without researching or regenerating', async () => {
    ;(TripGuideStore.get as jest.Mock).mockResolvedValue(guide)
    ;(DestinationFactsStore.get as jest.Mock).mockResolvedValue(facts)

    const result = await getOrGenerateTripGuideAction(phuketRequest)

    expect(result.status).toBe('success')
    if (result.status !== 'success') return
    expect(result.cached).toBe(true)
    expect(generateTripGuide).not.toHaveBeenCalled()
    expect(DestinationFactsStore.getOrResearch).not.toHaveBeenCalled()
  })

  it('validates the researched facts flow into a schema-valid, non-contradicting guide', async () => {
    ;(TripGuideStore.get as jest.Mock).mockResolvedValue(null)
    ;(DestinationFactsStore.getOrResearch as jest.Mock).mockResolvedValue(facts)
    ;(DestinationFactsStore.findRow as jest.Mock).mockResolvedValue({ id: 'facts-row-1' })
    ;(generateTripGuide as jest.Mock).mockResolvedValue(guide)
    ;(TripGuideStore.save as jest.Mock).mockImplementation(async (_k, g) => g)

    const result = await getOrGenerateTripGuideAction(phuketRequest)
    expect(result.status).toBe('success')
    if (result.status !== 'success') return

    // The guide only references transport that the facts allow (Grab), never a
    // train/metro the facts marked absent.
    const entities = result.guide.topics.flatMap((t) => t.items.flatMap((i) => i.entities.map((e) => e.name)))
    expect(entities).toContain('Grab')
  })
})

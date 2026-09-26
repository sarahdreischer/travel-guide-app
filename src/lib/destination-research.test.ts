import { researchDestination, DestinationResearchError } from '@/lib/destination-research'
import type { WebSource } from '@/lib/web-research'

// Mock the AI SDK so no real model call is made.
jest.mock('ai', () => ({
  generateObject: jest.fn(),
}))
jest.mock('@ai-sdk/openai', () => ({
  openai: jest.fn(() => ({ id: 'mock-model' })),
}))
jest.mock('@/lib/ai-rate-limiter', () => ({
  canCallAI: jest.fn(() => true),
  recordAICall: jest.fn(),
  recordAIFailure: jest.fn(),
  getRateLimitStatus: jest.fn(() => ({ minuteCount: 0, maxPerMinute: 3, dayCount: 0, maxPerDay: 50, inCooldown: false, cooldownRemainingSeconds: 0 })),
}))

import { generateObject } from 'ai'

const mockGenerateObject = generateObject as jest.Mock

const phuketSources: WebSource[] = [
  {
    url: 'https://www.tourismthailand.org/phuket',
    title: 'Phuket — Tourism Authority of Thailand',
    content: 'Phuket is an island in southern Thailand. Currency is the Thai Baht (THB). Thailand drives on the left.',
    sourceType: 'tourism_authority',
  },
  {
    url: 'https://en.wikipedia.org/wiki/Phuket',
    title: 'Phuket',
    content: 'Phuket is Thailand largest island. Major areas include Patong, Kata and Phuket Town.',
    sourceType: 'reputable_reference',
  },
]

const researchedPhuket = {
  destination: 'Phuket',
  country: 'Thailand',
  currency: { code: 'THB', name: 'Thai Baht' },
  drivingSide: 'left' as const,
  languages: ['Thai'],
  transport: {
    bus: true,
    train: false,
    tram: null,
    metro: null,
    taxi: true,
    rideHailing: ['Grab'],
  },
  geography: { type: 'island', majorAreas: ['Patong', 'Kata', 'Phuket Town'] },
}

describe('researchDestination', () => {
  beforeEach(() => jest.clearAllMocks())

  it('extracts facts and attaches provenance from the ACTUAL retrieved sources', async () => {
    mockGenerateObject.mockResolvedValue({ object: researchedPhuket })

    const facts = await researchDestination({
      destination: 'Phuket',
      country: 'Thailand',
      sources: phuketSources,
    })

    // Facts came from the model...
    expect(facts.currency.code).toBe('THB')
    expect(facts.drivingSide).toBe('left')
    // ...but sources are attached from the retrieved web sources, not the model.
    expect(facts.sources).toHaveLength(2)
    expect(facts.sources.map((s) => s.url)).toEqual(phuketSources.map((s) => s.url))
    expect(facts.sources[0].sourceType).toBe('tourism_authority')
  })

  it('keeps app-supplied destination/country authoritative over the model', async () => {
    mockGenerateObject.mockResolvedValue({
      object: { ...researchedPhuket, destination: 'WRONG', country: 'WRONG' },
    })

    const facts = await researchDestination({
      destination: 'Phuket',
      country: 'Thailand',
      sources: phuketSources,
    })

    expect(facts.destination).toBe('Phuket')
    expect(facts.country).toBe('Thailand')
  })

  it('preserves null (unknown) transport values rather than forcing false', async () => {
    mockGenerateObject.mockResolvedValue({ object: researchedPhuket })
    const facts = await researchDestination({ destination: 'Phuket', country: 'Thailand', sources: phuketSources })
    expect(facts.transport.tram).toBeNull()
    expect(facts.transport.metro).toBeNull()
  })

  it('throws when no web sources are available (never fabricates facts)', async () => {
    await expect(
      researchDestination({ destination: 'Nowhere', country: 'Nowhere', sources: [] })
    ).rejects.toBeInstanceOf(DestinationResearchError)
    expect(mockGenerateObject).not.toHaveBeenCalled()
  })
})

import {
  DestinationFactsSchema,
  parseDestinationFacts,
  safeParseDestinationFacts,
  ResearchedFactsSchema,
} from '@/lib/schemas/destination-facts'
import type { DestinationFacts } from '@/lib/schemas/destination-facts'

function validFacts(): DestinationFacts {
  return {
    destination: 'Phuket',
    country: 'Thailand',
    currency: { code: 'THB', name: 'Thai Baht' },
    drivingSide: 'left',
    languages: ['Thai'],
    transport: {
      bus: true,
      train: false,
      tram: null,
      metro: null,
      taxi: true,
      rideHailing: ['Grab'],
    },
    geography: { type: 'island', majorAreas: ['Patong', 'Kata'] },
    sources: [
      { url: 'https://en.wikipedia.org/wiki/Phuket', title: 'Phuket', sourceType: 'reputable_reference' },
    ],
  }
}

describe('DestinationFactsSchema', () => {
  it('accepts a well-formed facts object', () => {
    expect(() => parseDestinationFacts(validFacts())).not.toThrow()
  })

  it('allows null (unknown) for transport booleans — never forced to false', () => {
    const facts = validFacts()
    facts.transport.train = null
    facts.transport.metro = null
    const parsed = parseDestinationFacts(facts)
    expect(parsed.transport.train).toBeNull()
    expect(parsed.transport.metro).toBeNull()
  })

  it('requires at least one source (facts must be traceable)', () => {
    const facts = { ...validFacts(), sources: [] }
    const result = safeParseDestinationFacts(facts)
    expect(result.success).toBe(false)
  })

  it('rejects an invalid drivingSide', () => {
    const facts = { ...validFacts(), drivingSide: 'sideways' }
    expect(safeParseDestinationFacts(facts).success).toBe(false)
  })

  it('rejects an unknown sourceType', () => {
    const facts = validFacts()
    // @ts-expect-error — intentional invalid value
    facts.sources[0].sourceType = 'blog'
    expect(safeParseDestinationFacts(facts).success).toBe(false)
  })

  it('ResearchedFactsSchema excludes sources (attached by the app, not the model)', () => {
    const { sources, ...withoutSources } = validFacts()
    void sources
    expect(ResearchedFactsSchema.safeParse(withoutSources).success).toBe(true)
    // sources present should also be tolerated (omit is a subset), but the
    // researched shape itself must not require it.
    expect('sources' in ResearchedFactsSchema.parse(withoutSources)).toBe(false)
  })
})

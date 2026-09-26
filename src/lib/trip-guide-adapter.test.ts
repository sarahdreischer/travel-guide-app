import { tripGuideToGroups, tripGuideToSections, renderGuideItemAnswer } from '@/lib/trip-guide-adapter'
import type { TripGuide, GuideItem } from '@/lib/schemas/trip-guide'

function item(overrides: Partial<GuideItem> = {}): GuideItem {
  return {
    questionId: 'transport.ride_hailing.availability',
    priority: 'high',
    applicability: 'x',
    recommendation: 'Use Grab for most trips.',
    why: 'Cheaper than taxis.',
    answer: null,
    entities: [],
    claims: [],
    actions: ['Install Grab before arrival.'],
    ...overrides,
  }
}

function guide(): TripGuide {
  return {
    tripSummary: { destination: 'Phuket', country: 'Thailand', nights: 14, travellerType: 'couple', travelStyles: ['adventure'] },
    topics: [
      {
        topicId: 'transport',
        summary: { headline: 'Getting around', recommendation: 'Grab + taxis are easiest.' },
        items: [item()],
      },
      {
        topicId: 'health',
        summary: { headline: 'Health & safety', recommendation: 'Sort vaccinations early.' },
        items: [item({ questionId: 'health.vaccinations', recommendation: 'Confirm routine jabs.', actions: [] })],
      },
    ],
  }
}

describe('renderGuideItemAnswer', () => {
  it('combines recommendation, why, and actions into one string', () => {
    const text = renderGuideItemAnswer(item())
    expect(text).toContain('Use Grab for most trips.')
    expect(text).toContain('Cheaper than taxis.')
    expect(text).toContain('Next steps: Install Grab before arrival.')
  })
})

describe('tripGuideToGroups', () => {
  it('maps each topic to a GroupSection with matching id (keeps UI icons working)', () => {
    const groups = tripGuideToGroups(guide())
    expect(groups.map((g) => g.id)).toEqual(['transport', 'health'])
    expect(groups[0].keyTip).toBe('Grab + taxis are easiest.')
  })

  it('resolves questionIds back to natural-language question text for the accordion', () => {
    const groups = tripGuideToGroups(guide())
    const transport = groups[0]
    const questions = transport.sources[0].subQuestions
    expect(questions.some((q) => /ride-hailing/i.test(q))).toBe(true)
  })

  it('omits topics with no renderable items', () => {
    const g = guide()
    g.topics[0].items = [item({ recommendation: null, answer: null, why: null, actions: [] })]
    const groups = tripGuideToGroups(g)
    expect(groups.map((gr) => gr.id)).not.toContain('transport')
  })
})

describe('tripGuideToSections', () => {
  it('produces one section per topic with populated answers', () => {
    const sections = tripGuideToSections(guide())
    expect(sections).toHaveLength(2)
    expect(sections[0].answers).not.toBeNull()
    expect(sections[0].subQuestions.length).toBeGreaterThan(0)
  })
})

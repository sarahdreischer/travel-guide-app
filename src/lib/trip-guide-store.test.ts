import { TripGuideStore, tripGuideKeyForTrip } from '@/lib/trip-guide-store'
import type { TripGuide } from '@/lib/schemas/trip-guide'

function topic(topicId: string, headline: string): TripGuide['topics'][number] {
  return {
    topicId,
    summary: { headline, recommendation: 'r' },
    items: [
      {
        questionId: `${topicId}.x`,
        priority: 'high',
        applicability: 'x',
        recommendation: 'do',
        why: null,
        answer: null,
        entities: [],
        claims: [],
        actions: [],
      },
    ],
  }
}

const base: TripGuide = {
  tripSummary: { destination: 'Phuket', country: 'Thailand', nights: 14, travellerType: 'couple', travelStyles: ['adventure'] },
  topics: [topic('transport', 'transport v1'), topic('money', 'money v1')],
}

describe('TripGuideStore.mergeTopics', () => {
  it('appends brand-new topics, preserving existing ones and tripSummary', () => {
    const merged = TripGuideStore.mergeTopics(base, [topic('health', 'health v1')])
    expect(merged.topics.map((t) => t.topicId)).toEqual(['transport', 'money', 'health'])
    expect(merged.tripSummary).toEqual(base.tripSummary)
  })

  it('replaces a topic with the same id rather than duplicating it', () => {
    const merged = TripGuideStore.mergeTopics(base, [topic('money', 'money v2')])
    expect(merged.topics.map((t) => t.topicId)).toEqual(['transport', 'money'])
    const money = merged.topics.find((t) => t.topicId === 'money')!
    expect(money.summary.headline).toBe('money v2')
  })

  it('handles a mix of replacement and new topics', () => {
    const merged = TripGuideStore.mergeTopics(base, [topic('transport', 'transport v2'), topic('weather', 'weather v1')])
    expect(merged.topics.map((t) => t.topicId)).toEqual(['transport', 'money', 'weather'])
    expect(merged.topics.find((t) => t.topicId === 'transport')!.summary.headline).toBe('transport v2')
  })
})

describe('tripGuideKeyForTrip', () => {
  it('derives a lower-cased, month-ranged, budget-tiered key', () => {
    const key = tripGuideKeyForTrip({
      destination: 'Phuket, Thailand',
      startDate: '2026-11-01',
      endDate: '2026-11-15',
      travelMode: 'Couple',
      budgetUsd: 3500,
    })
    expect(key).toEqual({
      destination: 'phuket, thailand',
      startMonth: 'november',
      endMonth: 'november',
      travellerType: 'couple',
      budgetRange: 'luxury',
    })
  })
})

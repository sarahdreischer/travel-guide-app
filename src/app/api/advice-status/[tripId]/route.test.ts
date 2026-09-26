import { GET } from '@/app/api/advice-status/[tripId]/route'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockTrip = {
  id: 'trip-1',
  destination: 'Phuket, Thailand',
  startDate: '2026-11-01',
  endDate: '2026-11-15',
  travelMode: 'Couple',
  budgetUsd: 3500,
}

let tripRow: unknown = mockTrip

jest.mock('@/db', () => {
  const limit = jest.fn(() => Promise.resolve(tripRow ? [tripRow] : []))
  const where = jest.fn(() => ({ limit }))
  const from = jest.fn(() => ({ where }))
  const select = jest.fn(() => ({ from }))
  return { db: { select } }
})

jest.mock('@/db/schema', () => ({ trips: { id: 'id' } }))

jest.mock('@/lib/advice-store', () => ({
  AdviceStore: { getForTrip: jest.fn() },
}))

jest.mock('@/lib/destinations', () => ({
  CATEGORIES: ['A', 'B', 'C'],
  getSubQuestions: jest.fn(() => ['q1']),
}))

jest.mock('@/lib/trip-guide-store', () => ({
  TripGuideStore: { isReady: jest.fn() },
  tripGuideKeyForTrip: jest.fn(() => ({
    destination: 'phuket, thailand',
    startMonth: 'november',
    endMonth: 'november',
    travellerType: 'couple',
    budgetRange: 'luxury',
  })),
}))

import { AdviceStore } from '@/lib/advice-store'
import { TripGuideStore } from '@/lib/trip-guide-store'

const params = Promise.resolve({ tripId: 'trip-1' })
const req = new Request('http://localhost/api/advice-status/trip-1')

function mockAdvice(count: number) {
  ;(AdviceStore.getForTrip as jest.Mock).mockResolvedValue(Array.from({ length: count }, (_, i) => ({ category: `c${i}` })))
}

describe('advice-status GET', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    tripRow = mockTrip
  })

  it('reports structured "ready" and complete when the structured guide exists', async () => {
    mockAdvice(0) // legacy not ready
    ;(TripGuideStore.isReady as jest.Mock).mockResolvedValue(true)

    const res = await GET(req, { params })
    const body = await res.json()

    expect(body.structuredGuide.status).toBe('ready')
    expect(body.source).toBe('structured')
    expect(body.complete).toBe(true)
    expect(body.legacyComplete).toBe(false)
  })

  it('is complete via the legacy fallback when structured is pending but legacy is fully cached', async () => {
    mockAdvice(3) // all 3 categories ready
    ;(TripGuideStore.isReady as jest.Mock).mockResolvedValue(false)

    const res = await GET(req, { params })
    const body = await res.json()

    expect(body.structuredGuide.status).toBe('pending')
    expect(body.legacyComplete).toBe(true)
    expect(body.source).toBe('legacy')
    expect(body.complete).toBe(true)
  })

  it('is NOT complete while both paths are still pending', async () => {
    mockAdvice(1) // partial legacy
    ;(TripGuideStore.isReady as jest.Mock).mockResolvedValue(false)

    const res = await GET(req, { params })
    const body = await res.json()

    expect(body.complete).toBe(false)
    expect(body.source).toBeNull()
    expect(body.ready).toBe(1)
    expect(body.total).toBe(3)
  })

  it('prefers structured even when legacy is also complete', async () => {
    mockAdvice(3)
    ;(TripGuideStore.isReady as jest.Mock).mockResolvedValue(true)

    const res = await GET(req, { params })
    const body = await res.json()

    expect(body.source).toBe('structured')
    expect(body.complete).toBe(true)
  })

  it('does not let a structured-guide lookup error break the poll', async () => {
    mockAdvice(3)
    ;(TripGuideStore.isReady as jest.Mock).mockRejectedValue(new Error('db down'))

    const res = await GET(req, { params })
    const body = await res.json()

    // Falls back to the legacy signal.
    expect(body.structuredGuide.status).toBe('pending')
    expect(body.complete).toBe(true)
    expect(body.source).toBe('legacy')
  })

  it('returns 404 when the trip does not exist', async () => {
    tripRow = null
    const res = await GET(req, { params })
    expect(res.status).toBe(404)
  })
})

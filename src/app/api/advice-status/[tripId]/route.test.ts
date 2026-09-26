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

import { TripGuideStore } from '@/lib/trip-guide-store'

const params = Promise.resolve({ tripId: 'trip-1' })
const req = new Request('http://localhost/api/advice-status/trip-1')

describe('advice-status GET (structured-only)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    tripRow = mockTrip
  })

  it('is complete when the structured guide is ready', async () => {
    ;(TripGuideStore.isReady as jest.Mock).mockResolvedValue(true)

    const res = await GET(req, { params })
    const body = await res.json()

    expect(body.structuredGuide.status).toBe('ready')
    expect(body.source).toBe('structured')
    expect(body.complete).toBe(true)
    expect(body.ready).toBe(1)
    expect(body.total).toBe(1)
  })

  it('is pending (not complete) while the structured guide is not ready', async () => {
    ;(TripGuideStore.isReady as jest.Mock).mockResolvedValue(false)

    const res = await GET(req, { params })
    const body = await res.json()

    expect(body.structuredGuide.status).toBe('pending')
    expect(body.complete).toBe(false)
    expect(body.source).toBeNull()
    expect(body.ready).toBe(0)
  })

  it('treats a structured-guide lookup error as pending (never breaks the poll)', async () => {
    ;(TripGuideStore.isReady as jest.Mock).mockRejectedValue(new Error('db down'))

    const res = await GET(req, { params })
    const body = await res.json()

    expect(body.complete).toBe(false)
    expect(body.structuredGuide.status).toBe('pending')
    expect(body.source).toBeNull()
  })

  it('returns 404 when the trip does not exist', async () => {
    tripRow = null
    const res = await GET(req, { params })
    expect(res.status).toBe(404)
  })
})

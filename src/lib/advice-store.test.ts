import { AdviceStore } from '@/lib/advice-store'
import type { CacheKey, NewAdviceRecord } from '@/lib/advice-store'

// Mock the database module
jest.mock('@/db', () => {
  const mockSelect = jest.fn()
  const mockFrom = jest.fn()
  const mockWhere = jest.fn()
  const mockLimit = jest.fn()
  const mockInsert = jest.fn()
  const mockValues = jest.fn()
  const mockReturning = jest.fn()

  // Chain for select queries
  mockSelect.mockReturnValue({ from: mockFrom })
  mockFrom.mockReturnValue({ where: mockWhere })
  mockWhere.mockReturnValue({ limit: mockLimit })
  mockLimit.mockResolvedValue([])

  // Chain for insert queries
  mockInsert.mockReturnValue({ values: mockValues })
  mockValues.mockReturnValue({ returning: mockReturning })
  mockReturning.mockResolvedValue([])

  return {
    db: {
      select: mockSelect,
      insert: mockInsert,
      _mocks: { mockSelect, mockFrom, mockWhere, mockLimit, mockInsert, mockValues, mockReturning },
    },
  }
})

// Mock the schema module
jest.mock('@/db/schema', () => ({
  adviceCache: {
    destination: 'destination',
    month: 'month',
    travellerType: 'traveller_type',
    budgetRange: 'budget_range',
    category: 'category',
    id: 'id',
  },
  trips: {
    id: 'id',
  },
}))

// We need to get access to our mocks
const { db } = jest.requireMock('@/db') as {
  db: {
    select: jest.Mock
    insert: jest.Mock
    _mocks: {
      mockSelect: jest.Mock
      mockFrom: jest.Mock
      mockWhere: jest.Mock
      mockLimit: jest.Mock
      mockInsert: jest.Mock
      mockValues: jest.Mock
      mockReturning: jest.Mock
    }
  }
}

describe('AdviceStore', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Reset the chain for each test
    const { mockSelect, mockFrom, mockWhere, mockLimit, mockInsert, mockValues, mockReturning } =
      db._mocks
    mockSelect.mockReturnValue({ from: mockFrom })
    mockFrom.mockReturnValue({ where: mockWhere })
    mockWhere.mockReturnValue({ limit: mockLimit })
    mockLimit.mockResolvedValue([])
    mockInsert.mockReturnValue({ values: mockValues })
    mockValues.mockReturnValue({ returning: mockReturning })
    mockReturning.mockResolvedValue([])
  })

  describe('findByCacheKey', () => {
    it('returns null when no matching record exists', async () => {
      const key: CacheKey = {
        destination: 'costa rica',
        month: 'january',
        travellerType: 'solo',
        budgetRange: 'mid',
      }

      const result = await AdviceStore.findByCacheKey(key, 'food')

      expect(result).toBeNull()
      expect(db.select).toHaveBeenCalled()
    })

    it('returns the matching record when one exists', async () => {
      const adviceRow = {
        id: '123',
        destination: 'costa rica',
        month: 'january',
        travellerType: 'solo',
        budgetRange: 'mid',
        category: 'food',
        answers: { 'tipping-expected': 'Yes, 10% is customary' },
        generatedAt: new Date(),
      }

      db._mocks.mockLimit.mockResolvedValue([adviceRow])

      const key: CacheKey = {
        destination: 'costa rica',
        month: 'january',
        travellerType: 'solo',
        budgetRange: 'mid',
      }

      const result = await AdviceStore.findByCacheKey(key, 'food')

      expect(result).toEqual(adviceRow)
    })
  })

  describe('save', () => {
    it('inserts a new advice record and returns it', async () => {
      const newAdvice: NewAdviceRecord = {
        destination: 'mallorca',
        month: 'july',
        travellerType: 'couple',
        budgetRange: 'luxury',
        category: 'weather',
        answers: { 'rain-common': 'No, July is dry' },
      }

      const savedRow = { ...newAdvice, id: '456', generatedAt: new Date() }
      db._mocks.mockReturning.mockResolvedValue([savedRow])

      const result = await AdviceStore.save(newAdvice)

      expect(result).toEqual(savedRow)
      expect(db.insert).toHaveBeenCalled()
    })
  })

  describe('getForTrip', () => {
    it('returns empty array when trip is not found', async () => {
      const result = await AdviceStore.getForTrip('nonexistent-id')

      expect(result).toEqual([])
    })

    it('returns all advice records matching the trip cache key', async () => {
      const tripRow = {
        id: 'trip-1',
        userId: 'user-1',
        destination: 'Costa Rica',
        startDate: '2025-03-15',
        endDate: '2025-03-25',
        travelMode: 'Solo',
        budgetUsd: 200,
        travelStyle: 'Backpacking',
        activityPreferences: ['Hiking'],
        createdAt: new Date(),
      }

      const adviceRows = [
        {
          id: 'a1',
          destination: 'costa rica',
          month: 'march',
          travellerType: 'solo',
          budgetRange: 'mid',
          category: 'food',
          answers: {},
          generatedAt: new Date(),
        },
        {
          id: 'a2',
          destination: 'costa rica',
          month: 'march',
          travellerType: 'solo',
          budgetRange: 'mid',
          category: 'safety',
          answers: {},
          generatedAt: new Date(),
        },
      ]

      // First call: select trip - returns with limit
      // Second call: select advice - returns without limit (no .limit() in getForTrip for advice)
      const { mockSelect } = db._mocks

      let callCount = 0
      mockSelect.mockImplementation(() => ({
        from: () => ({
          where: () => {
            callCount++
            if (callCount === 1) {
              // Trip lookup - has .limit(1)
              return { limit: () => Promise.resolve([tripRow]) }
            }
            // Advice lookup - no .limit(), returns rows directly
            return Promise.resolve(adviceRows)
          },
        }),
      }))

      const result = await AdviceStore.getForTrip('trip-1')

      expect(result).toEqual(adviceRows)
    })
  })
})

import { AuthService } from '@/lib/auth'

// Mock dependencies
jest.mock('@/db', () => ({
  db: {
    select: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
}))

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
}))

jest.mock('crypto', () => ({
  randomBytes: jest.fn(() => ({
    toString: jest.fn(() => 'a'.repeat(64)), // 32 bytes = 64 hex chars
  })),
}))

import { db } from '@/db'
import bcrypt from 'bcrypt'

// Helper to create chainable query mock
function mockSelectChain(result: unknown[]) {
  const chain = {
    from: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue(result),
  }
  ;(db.select as jest.Mock).mockReturnValue(chain)
  return chain
}

function mockInsertChain() {
  const chain = {
    values: jest.fn().mockResolvedValue(undefined),
  }
  ;(db.insert as jest.Mock).mockReturnValue(chain)
  return chain
}

function mockUpdateChain() {
  const chain = {
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockResolvedValue(undefined),
  }
  ;(db.update as jest.Mock).mockReturnValue(chain)
  return chain
}

function mockDeleteChain() {
  const chain = {
    where: jest.fn().mockResolvedValue(undefined),
  }
  ;(db.delete as jest.Mock).mockReturnValue(chain)
  return chain
}

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('checkRateLimit', () => {
    it('returns not locked when no login_attempts record exists', async () => {
      mockSelectChain([])

      const result = await AuthService.checkRateLimit('test@example.com')
      expect(result).toEqual({ locked: false })
    })

    it('returns locked when lockedUntil is in the future', async () => {
      const futureDate = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes from now
      mockSelectChain([{ lockedUntil: futureDate, failedCount: 5 }])

      const result = await AuthService.checkRateLimit('test@example.com')
      expect(result.locked).toBe(true)
      expect(result.remainingMinutes).toBeGreaterThan(0)
      expect(result.remainingMinutes).toBeLessThanOrEqual(10)
    })

    it('returns not locked when lockedUntil is in the past', async () => {
      const pastDate = new Date(Date.now() - 1000)
      mockSelectChain([{ lockedUntil: pastDate, failedCount: 5 }])

      const result = await AuthService.checkRateLimit('test@example.com')
      expect(result).toEqual({ locked: false })
    })

    it('returns not locked when lockedUntil is null', async () => {
      mockSelectChain([{ lockedUntil: null, failedCount: 3 }])

      const result = await AuthService.checkRateLimit('test@example.com')
      expect(result).toEqual({ locked: false })
    })
  })

  describe('login', () => {
    it('returns account_locked error when rate limit check shows locked', async () => {
      const futureDate = new Date(Date.now() + 10 * 60 * 1000)
      // First select call is for checkRateLimit
      mockSelectChain([{ lockedUntil: futureDate, failedCount: 5 }])

      const result = await AuthService.login('test@example.com', 'password')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.type).toBe('account_locked')
      }
    })

    it('returns invalid_credentials when user is not found', async () => {
      // First call: checkRateLimit returns no record (not locked)
      // Second call: user lookup returns empty
      const chain = {
        from: jest.fn().mockReturnThis(),
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn(() => {
          // First call: rate limit check (no record)
          // Second call: user lookup (no user)
          return Promise.resolve([])
        }),
      }
      ;(db.select as jest.Mock).mockReturnValue(chain)
      mockInsertChain() // for recordFailedAttempt

      const result = await AuthService.login('nonexistent@example.com', 'password')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.type).toBe('invalid_credentials')
        expect(result.error.message).toBe('Email or password is incorrect.')
      }
    })

    it('returns invalid_credentials when password does not match', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        passwordHash: '$2b$12$hashedpassword',
      }

      let selectCallCount = 0
      const chain = {
        from: jest.fn().mockReturnThis(),
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn(() => {
          selectCallCount++
          if (selectCallCount === 1) return Promise.resolve([]) // checkRateLimit: no record
          if (selectCallCount === 2) return Promise.resolve([mockUser]) // user lookup
          return Promise.resolve([]) // recordFailedAttempt: no existing record
        }),
      }
      ;(db.select as jest.Mock).mockReturnValue(chain)
      ;(bcrypt.compare as jest.Mock).mockResolvedValue(false)
      mockInsertChain()

      const result = await AuthService.login('test@example.com', 'wrongpassword')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.type).toBe('invalid_credentials')
      }
      expect(bcrypt.compare).toHaveBeenCalledWith('wrongpassword', '$2b$12$hashedpassword')
    })

    it('returns session token on successful login', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        passwordHash: '$2b$12$hashedpassword',
      }

      let selectCallCount = 0
      const chain = {
        from: jest.fn().mockReturnThis(),
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn(() => {
          selectCallCount++
          if (selectCallCount === 1) return Promise.resolve([]) // checkRateLimit: no record
          if (selectCallCount === 2) return Promise.resolve([mockUser]) // user lookup
          return Promise.resolve([])
        }),
      }
      ;(db.select as jest.Mock).mockReturnValue(chain)
      ;(bcrypt.compare as jest.Mock).mockResolvedValue(true)
      mockDeleteChain() // for resetFailedAttempts
      mockInsertChain() // for session insert

      const result = await AuthService.login('test@example.com', 'correctpassword')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.token).toBe('a'.repeat(64))
        expect(result.expiresAt).toBeInstanceOf(Date)
        // Verify expiry is approximately 24 hours from now
        const expectedExpiry = Date.now() + 24 * 60 * 60 * 1000
        expect(result.expiresAt.getTime()).toBeCloseTo(expectedExpiry, -3)
      }
    })
  })

  describe('getSession', () => {
    it('returns user when session token is valid and not expired', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        profileImagePath: null,
        setupComplete: true,
        createdAt: new Date(),
      }
      mockSelectChain([mockUser])

      const result = await AuthService.getSession('valid-token')

      expect(result).toEqual(mockUser)
    })

    it('returns null when no matching session found', async () => {
      mockSelectChain([])

      const result = await AuthService.getSession('invalid-token')

      expect(result).toBeNull()
    })
  })

  describe('logout', () => {
    it('deletes the session row', async () => {
      const deleteChain = mockDeleteChain()

      await AuthService.logout('session-token')

      expect(db.delete).toHaveBeenCalled()
      expect(deleteChain.where).toHaveBeenCalled()
    })
  })

  describe('recordFailedAttempt', () => {
    it('creates a new login_attempts record on first failure', async () => {
      mockSelectChain([])
      const insertChain = mockInsertChain()

      await AuthService.recordFailedAttempt('test@example.com')

      expect(db.insert).toHaveBeenCalled()
      expect(insertChain.values).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'test@example.com',
          failedCount: 1,
          lockedUntil: null,
        })
      )
    })

    it('increments failed count on subsequent failures', async () => {
      mockSelectChain([{ failedCount: 3, lockedUntil: null, email: 'test@example.com' }])
      const updateChain = mockUpdateChain()

      await AuthService.recordFailedAttempt('test@example.com')

      expect(db.update).toHaveBeenCalled()
      expect(updateChain.set).toHaveBeenCalledWith(
        expect.objectContaining({
          failedCount: 4,
          lockedUntil: null,
        })
      )
    })

    it('sets lockedUntil when reaching 5 failures', async () => {
      mockSelectChain([{ failedCount: 4, lockedUntil: null, email: 'test@example.com' }])
      const updateChain = mockUpdateChain()

      await AuthService.recordFailedAttempt('test@example.com')

      expect(db.update).toHaveBeenCalled()
      expect(updateChain.set).toHaveBeenCalledWith(
        expect.objectContaining({
          failedCount: 5,
        })
      )
      // Verify lockedUntil is set to ~15 minutes from now
      const setArg = (updateChain.set as jest.Mock).mock.calls[0][0]
      expect(setArg.lockedUntil).toBeInstanceOf(Date)
      const lockTime = setArg.lockedUntil.getTime()
      const expectedLock = Date.now() + 15 * 60 * 1000
      expect(lockTime).toBeCloseTo(expectedLock, -3)
    })

    it('resets counter when lock has expired', async () => {
      const pastLock = new Date(Date.now() - 1000)
      mockSelectChain([{ failedCount: 5, lockedUntil: pastLock, email: 'test@example.com' }])
      const updateChain = mockUpdateChain()

      await AuthService.recordFailedAttempt('test@example.com')

      expect(db.update).toHaveBeenCalled()
      expect(updateChain.set).toHaveBeenCalledWith(
        expect.objectContaining({
          failedCount: 1,
          lockedUntil: null,
        })
      )
    })
  })
})

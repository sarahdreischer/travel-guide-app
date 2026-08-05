import { db } from '@/db'
import { users, sessions, loginAttempts } from '@/db/schema'
import { eq, and, gt } from 'drizzle-orm'
import bcrypt from 'bcrypt'
import crypto from 'crypto'

export type AuthError = {
  type: 'invalid_credentials' | 'account_locked'
  message: string
  remainingMinutes?: number
}

export type LoginResult =
  | { success: true; token: string; expiresAt: Date }
  | { success: false; error: AuthError }

export type RateLimitResult = {
  locked: boolean
  remainingMinutes?: number
}

const SESSION_DURATION_MS = 24 * 60 * 60 * 1000 // 24 hours
const LOCK_DURATION_MS = 15 * 60 * 1000 // 15 minutes
const MAX_FAILED_ATTEMPTS = 5

export const AuthService = {
  /**
   * Validates credentials, creates session, returns session token.
   * Flow: check rate limit → if locked return error → compare password →
   * if wrong increment failures → if correct reset failures and create session
   */
  async login(email: string, password: string): Promise<LoginResult> {
    // Step 1: Check rate limit BEFORE password comparison
    const rateLimitResult = await AuthService.checkRateLimit(email)
    if (rateLimitResult.locked) {
      return {
        success: false,
        error: {
          type: 'account_locked',
          message: 'Account is temporarily locked due to too many failed login attempts.',
          remainingMinutes: rateLimitResult.remainingMinutes,
        },
      }
    }

    // Step 2: Look up user by email
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1)

    if (!user) {
      // Increment failed attempts even for non-existent users to prevent
      // email enumeration via timing attacks
      await AuthService.recordFailedAttempt(email)
      return {
        success: false,
        error: {
          type: 'invalid_credentials',
          message: 'Email or password is incorrect.',
        },
      }
    }

    // Step 3: Compare bcrypt hash
    const passwordMatch = await bcrypt.compare(password, user.passwordHash)

    if (!passwordMatch) {
      await AuthService.recordFailedAttempt(email)
      return {
        success: false,
        error: {
          type: 'invalid_credentials',
          message: 'Email or password is incorrect.',
        },
      }
    }

    // Step 4: Password correct — reset failed attempts
    await AuthService.resetFailedAttempts(email)

    // Step 5: Create session token (32-byte hex)
    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS)

    await db.insert(sessions).values({
      userId: user.id,
      token,
      expiresAt,
    })

    return { success: true, token, expiresAt }
  },

  /**
   * Validates session token, returns user or null if expired/invalid.
   */
  async getSession(token: string) {
    const now = new Date()

    const result = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        profileImagePath: users.profileImagePath,
        setupComplete: users.setupComplete,
        createdAt: users.createdAt,
      })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(and(eq(sessions.token, token), gt(sessions.expiresAt, now)))
      .limit(1)

    return result[0] ?? null
  },

  /**
   * Invalidates session token by deleting the session row.
   */
  async logout(token: string): Promise<void> {
    await db.delete(sessions).where(eq(sessions.token, token))
  },

  /**
   * Checks if the account is currently locked due to too many failed attempts.
   * Returns locked status and remaining lock time if applicable.
   */
  async checkRateLimit(email: string): Promise<RateLimitResult> {
    const [attempt] = await db
      .select()
      .from(loginAttempts)
      .where(eq(loginAttempts.email, email))
      .limit(1)

    if (!attempt) {
      return { locked: false }
    }

    // Check if account is locked and lock hasn't expired
    if (attempt.lockedUntil && attempt.lockedUntil > new Date()) {
      const remainingMs = attempt.lockedUntil.getTime() - Date.now()
      const remainingMinutes = Math.ceil(remainingMs / (60 * 1000))
      return { locked: true, remainingMinutes }
    }

    return { locked: false }
  },

  /**
   * Records a failed login attempt. If failures reach the threshold (5),
   * locks the account for 15 minutes.
   */
  async recordFailedAttempt(email: string): Promise<void> {
    const [existing] = await db
      .select()
      .from(loginAttempts)
      .where(eq(loginAttempts.email, email))
      .limit(1)

    const now = new Date()

    if (!existing) {
      // First failed attempt for this email
      await db.insert(loginAttempts).values({
        email,
        failedCount: 1,
        lockedUntil: null,
        updatedAt: now,
      })
      return
    }

    // If previously locked but lock has expired, reset the counter
    if (existing.lockedUntil && existing.lockedUntil <= new Date()) {
      await db
        .update(loginAttempts)
        .set({
          failedCount: 1,
          lockedUntil: null,
          updatedAt: now,
        })
        .where(eq(loginAttempts.email, email))
      return
    }

    const newCount = existing.failedCount + 1
    const lockedUntil =
      newCount >= MAX_FAILED_ATTEMPTS
        ? new Date(Date.now() + LOCK_DURATION_MS)
        : existing.lockedUntil

    await db
      .update(loginAttempts)
      .set({
        failedCount: newCount,
        lockedUntil,
        updatedAt: now,
      })
      .where(eq(loginAttempts.email, email))
  },

  /**
   * Resets failed attempt counter after a successful login.
   */
  async resetFailedAttempts(email: string): Promise<void> {
    await db
      .delete(loginAttempts)
      .where(eq(loginAttempts.email, email))
  },
}

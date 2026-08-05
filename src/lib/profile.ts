// Profile_Service — Requirements 2.2, 2.3, 2.7, 9.2, 9.3, 9.6

import { db } from '@/db'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcrypt'
import { validateProfileImage, type ImageValidationResult } from '@/lib/validators'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CreateProfileData {
  firstName: string
  lastName: string
  email: string
  password: string
  profileImagePath?: string | null
}

export interface UpdateProfileData {
  firstName?: string
  lastName?: string
  profileImagePath?: string | null
}

// ─── Profile Service ──────────────────────────────────────────────────────────

const BCRYPT_COST_FACTOR = 12

export const ProfileService = {
  /**
   * Creates a new user profile with setup_complete = true.
   * Hashes the password with bcrypt (cost factor 12) before storing.
   *
   * Requirements: 2.2, 2.3
   */
  async create(data: CreateProfileData) {
    const passwordHash = await bcrypt.hash(data.password, BCRYPT_COST_FACTOR)

    const [user] = await db
      .insert(users)
      .values({
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        passwordHash,
        profileImagePath: data.profileImagePath ?? null,
        setupComplete: true,
      })
      .returning()

    return user
  },

  /**
   * Updates an existing user's profile fields.
   * Only updates the fields provided in `data`.
   *
   * Requirements: 9.2
   */
  async update(userId: string, data: UpdateProfileData) {
    const [user] = await db
      .update(users)
      .set(data)
      .where(eq(users.id, userId))
      .returning()

    return user
  },

  /**
   * Permanently deletes a user account.
   * Cascading FK constraints handle removal of sessions, trips, and votes.
   *
   * Requirements: 9.6
   */
  async deleteAccount(userId: string): Promise<void> {
    await db.delete(users).where(eq(users.id, userId))
  },

  /**
   * Validates a profile image upload by delegating to the shared validator.
   * Accepts JPEG, PNG, or WebP format with a maximum size of 5 MB.
   *
   * Requirements: 2.7, 9.3
   */
  validateImage(file: { mimeType: string; size: number }): ImageValidationResult {
    return validateProfileImage(file)
  },
}

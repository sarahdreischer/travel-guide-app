'use server'

import { db } from '@/db'
import { users, passwordResetTokens } from '@/db/schema'
import { eq, and, gt, isNull } from 'drizzle-orm'
import bcrypt from 'bcrypt'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ResetPasswordResult =
  | { success: true }
  | { success: false; error: string }

// ─── Constants ────────────────────────────────────────────────────────────────

const SALT_ROUNDS = 10

// ─── Server Action ────────────────────────────────────────────────────────────

/**
 * Validates the reset token and updates the user's password.
 * The token must be valid (exists, not expired, not already used).
 */
export async function resetPasswordAction(
  token: string,
  newPassword: string
): Promise<ResetPasswordResult> {
  if (!token || token.length < 32) {
    return { success: false, error: 'Invalid or expired reset link.' }
  }

  if (!newPassword || newPassword.length < 8) {
    return { success: false, error: 'Password must be at least 8 characters.' }
  }

  // Look up the token — must be unexpired and unused
  const now = new Date()
  const [resetRow] = await db
    .select()
    .from(passwordResetTokens)
    .where(
      and(
        eq(passwordResetTokens.token, token),
        gt(passwordResetTokens.expiresAt, now),
        isNull(passwordResetTokens.usedAt)
      )
    )
    .limit(1)

  if (!resetRow) {
    return { success: false, error: 'Invalid or expired reset link. Please request a new one.' }
  }

  // Hash the new password
  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS)

  // Update the user's password
  await db
    .update(users)
    .set({ passwordHash })
    .where(eq(users.id, resetRow.userId))

  // Mark the token as used
  await db
    .update(passwordResetTokens)
    .set({ usedAt: now })
    .where(eq(passwordResetTokens.id, resetRow.id))

  return { success: true }
}

/**
 * Validates that a token is still valid (for showing the form vs an error).
 */
export async function validateResetTokenAction(
  token: string
): Promise<{ valid: boolean }> {
  if (!token || token.length < 32) {
    return { valid: false }
  }

  const now = new Date()
  const [row] = await db
    .select({ id: passwordResetTokens.id })
    .from(passwordResetTokens)
    .where(
      and(
        eq(passwordResetTokens.token, token),
        gt(passwordResetTokens.expiresAt, now),
        isNull(passwordResetTokens.usedAt)
      )
    )
    .limit(1)

  return { valid: !!row }
}

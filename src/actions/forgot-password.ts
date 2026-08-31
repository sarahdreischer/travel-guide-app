'use server'

import { db } from '@/db'
import { users, passwordResetTokens } from '@/db/schema'
import { eq } from 'drizzle-orm'
import crypto from 'crypto'
import { sendEmail } from '@/lib/email'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ForgotPasswordResult =
  | { success: true }
  | { success: false; error: string }

// ─── Constants ────────────────────────────────────────────────────────────────

const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000 // 24 hours

// ─── Server Action ────────────────────────────────────────────────────────────

/**
 * Generates a password reset token and sends a reset link via email.
 * Always returns success to prevent email enumeration — even if the
 * email doesn't exist in our system, we respond identically.
 */
export async function forgotPasswordAction(
  _prevState: ForgotPasswordResult | null,
  formData: FormData
): Promise<ForgotPasswordResult> {
  const email = (formData.get('email') as string)?.trim().toLowerCase()

  if (!email || !email.includes('@')) {
    return { success: false, error: 'Please enter a valid email address.' }
  }

  // Look up user (but don't reveal if they exist)
  const [user] = await db
    .select({ id: users.id, firstName: users.firstName })
    .from(users)
    .where(eq(users.email, email))
    .limit(1)

  if (!user) {
    // Don't reveal that the email doesn't exist — return success anyway
    return { success: true }
  }

  // Generate a secure token
  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MS)

  // Store the token
  await db.insert(passwordResetTokens).values({
    userId: user.id,
    token,
    expiresAt,
  })

  // Build the reset URL
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const resetUrl = `${baseUrl}/reset-password?token=${token}`

  // Send the email
  try {
    await sendEmail({
      to: email,
      subject: 'Reset your Trip Guide password',
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 24px;">
          <p style="font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #1A5568; margin-bottom: 24px;">Trip Guide</p>
          <h1 style="font-size: 22px; font-weight: 700; color: #111318; margin-bottom: 8px;">Reset your password</h1>
          <p style="font-size: 14px; color: #6B7280; line-height: 1.6; margin-bottom: 24px;">
            Hi ${user.firstName}, we received a request to reset your password. Click the button below to choose a new one. This link expires in 24 hours.
          </p>
          <a href="${resetUrl}" style="display: inline-block; padding: 14px 28px; background: #111318; color: #fff; font-size: 14px; font-weight: 500; text-decoration: none; border-radius: 4px;">
            Reset password
          </a>
          <p style="font-size: 12px; color: #9CA3AF; margin-top: 32px; line-height: 1.6;">
            If you didn't request this, you can safely ignore this email. Your password won't change unless you click the link above.
          </p>
        </div>
      `,
      text: `Reset your Trip Guide password\n\nHi ${user.firstName}, visit this link to reset your password (expires in 24 hours):\n\n${resetUrl}\n\nIf you didn't request this, ignore this email.`,
    })
  } catch (err) {
    console.error('[forgotPasswordAction] Failed to send email:', err)
    // Still return success to prevent enumeration
  }

  return { success: true }
}

/**
 * Resend the reset email — generates a fresh token.
 */
export async function resendResetEmailAction(email: string): Promise<{ success: boolean }> {
  const fd = new FormData()
  fd.set('email', email)
  const result = await forgotPasswordAction(null, fd)
  return { success: result.success }
}

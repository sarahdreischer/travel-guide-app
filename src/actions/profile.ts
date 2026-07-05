'use server'

import { ProfileService } from '@/lib/profile'
import { AuthService } from '@/lib/auth'
import { validateEmail, validateUsername } from '@/lib/validators'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { users } from '@/db/schema'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ProfileFieldErrors = {
  firstName?: string
  lastName?: string
  email?: string
  profileImage?: string
}

export type ProfileActionResult =
  | { success: true }
  | { success: false; errors: ProfileFieldErrors }

export type UpdateProfileFieldErrors = {
  firstName?: string
  lastName?: string
  profileImage?: string
}

export type UpdateProfileActionResult =
  | { success: true }
  | { success: false; errors: UpdateProfileFieldErrors }

// ─── setupProfileAction ───────────────────────────────────────────────────────

/**
 * Validates profile setup fields and creates a new user profile.
 * On success, logs the user in and redirects to /home.
 *
 * Requirements: 2.3, 2.4, 2.7, 2.8
 */
export async function setupProfileAction(formData: FormData): Promise<ProfileActionResult> {
  const firstName = (formData.get('firstName') as string | null)?.trim() ?? ''
  const lastName = (formData.get('lastName') as string | null)?.trim() ?? ''
  const email = (formData.get('email') as string | null)?.trim() ?? ''
  const password = (formData.get('password') as string | null) ?? ''
  const profileImage = formData.get('profileImage') as File | null

  // ── Validate required fields ──
  const errors: ProfileFieldErrors = {}

  if (!firstName) {
    errors.firstName = 'First name is required.'
  }
  if (!lastName) {
    errors.lastName = 'Last name is required.'
  }
  if (!email) {
    errors.email = 'Email is required.'
  } else if (!validateEmail(email)) {
    errors.email = 'Please enter a valid email address (e.g. name@example.com).'
  }

  // ── Validate profile image if provided ──
  if (profileImage && profileImage.size > 0) {
    const imageResult = ProfileService.validateImage({
      mimeType: profileImage.type,
      size: profileImage.size,
    })
    if (!imageResult.valid) {
      errors.profileImage =
        imageResult.error === 'invalid_format'
          ? 'Profile image must be JPEG, PNG, or WebP format.'
          : 'Profile image must be 5 MB or smaller.'
    }
  }

  if (Object.keys(errors).length > 0) {
    return { success: false, errors }
  }

  // ── Check for duplicate email ──
  const [existingUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1)

  if (existingUser) {
    return {
      success: false,
      errors: { email: 'An account with this email already exists.' },
    }
  }

  // ── Create profile ──
  // For MVP, profile image path is stored as null unless a file storage layer is added.
  // The image file would be written to disk/object storage and its path stored here.
  let profileImagePath: string | null = null
  if (profileImage && profileImage.size > 0) {
    // In a full implementation, the image would be saved to storage here.
    // For now, we store a reference path based on a timestamp to avoid collisions.
    profileImagePath = `/uploads/profiles/${Date.now()}-${profileImage.name}`
  }

  await ProfileService.create({
    firstName,
    lastName,
    email,
    password,
    profileImagePath,
  })

  // ── Create session and set cookie ──
  const loginResult = await AuthService.login(email, password)

  if (loginResult.success) {
    const cookieStore = await cookies()
    cookieStore.set('session_token', loginResult.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      expires: loginResult.expiresAt,
    })
    cookieStore.set('setup_complete', 'true', {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      expires: loginResult.expiresAt,
    })
  }

  // redirect() must NOT be inside try/catch — it throws a special Next.js error
  redirect('/destinations')
}

// ─── updateProfileAction ──────────────────────────────────────────────────────

/**
 * Validates and updates an existing user's profile fields.
 * Reads current user from session cookie.
 *
 * Requirements: 9.2, 9.3
 */
export async function updateProfileAction(formData: FormData): Promise<UpdateProfileActionResult> {
  const cookieStore = await cookies()
  const token = cookieStore.get('session_token')?.value

  if (!token) {
    redirect('/login')
  }

  const currentUser = await AuthService.getSession(token)

  if (!currentUser) {
    redirect('/login')
  }

  const firstName = formData.get('firstName') as string | null
  const lastName = formData.get('lastName') as string | null
  const profileImage = formData.get('profileImage') as File | null

  const errors: UpdateProfileFieldErrors = {}

  // ── Validate username fields if provided ──
  if (firstName !== null) {
    const trimmedFirst = firstName.trim()
    if (!validateUsername(trimmedFirst)) {
      errors.firstName = 'First name must be between 1 and 255 characters.'
    }
  }

  if (lastName !== null) {
    const trimmedLast = lastName.trim()
    if (!validateUsername(trimmedLast)) {
      errors.lastName = 'Last name must be between 1 and 255 characters.'
    }
  }

  // ── Validate profile image if provided ──
  if (profileImage && profileImage.size > 0) {
    const imageResult = ProfileService.validateImage({
      mimeType: profileImage.type,
      size: profileImage.size,
    })
    if (!imageResult.valid) {
      errors.profileImage =
        imageResult.error === 'invalid_format'
          ? 'Profile image must be JPEG, PNG, or WebP format.'
          : 'Profile image must be 5 MB or smaller.'
    }
  }

  if (Object.keys(errors).length > 0) {
    return { success: false, errors }
  }

  // ── Build update data ──
  const updateData: { firstName?: string; lastName?: string; profileImagePath?: string | null } = {}

  if (firstName !== null) {
    updateData.firstName = firstName.trim()
  }
  if (lastName !== null) {
    updateData.lastName = lastName.trim()
  }
  if (profileImage && profileImage.size > 0) {
    updateData.profileImagePath = `/uploads/profiles/${Date.now()}-${profileImage.name}`
  }

  await ProfileService.update(currentUser.id, updateData)

  return { success: true }
}

// ─── deleteAccountAction ──────────────────────────────────────────────────────

/**
 * Permanently deletes the current user's account, clears the session cookie,
 * and redirects to the login page.
 *
 * Requirements: 9.6
 */
export async function deleteAccountAction(): Promise<void> {
  const cookieStore = await cookies()
  const token = cookieStore.get('session_token')?.value

  if (!token) {
    redirect('/login')
  }

  const currentUser = await AuthService.getSession(token)

  if (!currentUser) {
    redirect('/login')
  }

  await ProfileService.deleteAccount(currentUser.id)

  // Clear session cookie
  const store = await cookies()
  store.set('session_token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })

  // redirect() must NOT be inside try/catch — it throws a special Next.js error
  redirect('/login')
}

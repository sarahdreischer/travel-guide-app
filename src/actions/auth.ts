'use server'

import { AuthService, AuthError } from '@/lib/auth'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export type LoginActionResult = {
  error?: AuthError
}

export async function loginAction(
  prevState: LoginActionResult | null,
  formData: FormData
): Promise<LoginActionResult> {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const result = await AuthService.login(email, password)

  if (!result.success) {
    return { error: result.error }
  }

  // Set session cookie — HttpOnly, Secure, SameSite=Lax
  const cookieStore = await cookies()
  cookieStore.set('session_token', result.token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 86400, // 24 hours
  })

  // Set setup_complete cookie so middleware doesn't redirect to /setup
  // (login is only possible for users who already have accounts = setup complete)
  cookieStore.set('setup_complete', 'true', {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 86400,
  })

  redirect('/home')
}

export async function logoutAction(): Promise<void> {
  const cookieStore = await cookies()
  const token = cookieStore.get('session_token')?.value

  if (token) {
    await AuthService.logout(token)
  }

  cookieStore.delete('session_token')
  cookieStore.delete('setup_complete')

  redirect('/login')
}

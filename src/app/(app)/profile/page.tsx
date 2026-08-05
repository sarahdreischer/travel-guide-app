import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { AuthService } from '@/lib/auth'
import ProfileContent from '@/components/forms/ProfileContent'

/**
 * Profile page — Server Component.
 * Fetches the current user from session and renders ProfileContent client component.
 *
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6
 */
export default async function ProfilePage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('session_token')?.value

  if (!token) {
    redirect('/login')
  }

  const user = await AuthService.getSession(token)

  if (!user) {
    redirect('/login')
  }

  return (
    <ProfileContent
      user={{
        firstName: user.firstName,
        lastName: user.lastName,
        profileImagePath: user.profileImagePath,
      }}
    />
  )
}

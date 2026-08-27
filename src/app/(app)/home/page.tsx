import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { AuthService } from '@/lib/auth'
import { db } from '@/db'
import { trips } from '@/db/schema'
import { eq } from 'drizzle-orm'

/**
 * Home index page — redirects to the appropriate destination:
 * - If user has any trips → redirect to the Trips list
 * - If user has no trips → redirect to the "Add trip" wizard
 *
 * This page is never rendered directly — it always redirects.
 */
export default async function HomeIndexPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('session_token')?.value

  if (!token) redirect('/login')

  const user = await AuthService.getSession(token)
  if (!user) redirect('/login')

  const [anyTrip] = await db
    .select({ id: trips.id })
    .from(trips)
    .where(eq(trips.userId, user.id))
    .limit(1)

  if (anyTrip) {
    redirect('/destinations')
  } else {
    redirect('/trip/new')
  }
}

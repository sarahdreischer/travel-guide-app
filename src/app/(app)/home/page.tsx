import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { AuthService } from '@/lib/auth'
import { db } from '@/db'
import { trips } from '@/db/schema'
import { eq, desc } from 'drizzle-orm'

/**
 * Home index page — redirects to the appropriate destination:
 * - If user has trips → redirect to their most recent trip's home page
 * - If user has no trips → redirect to the "Add travel destination" page
 *
 * This page is never rendered directly — it always redirects.
 */
export default async function HomeIndexPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('session_token')?.value

  if (!token) {
    redirect('/login')
  }

  const user = await AuthService.getSession(token)

  if (!user) {
    redirect('/login')
  }

  // Find the user's most recent trip
  const [latestTrip] = await db
    .select({ id: trips.id })
    .from(trips)
    .where(eq(trips.userId, user.id))
    .orderBy(desc(trips.createdAt))
    .limit(1)

  if (latestTrip) {
    redirect(`/home/${latestTrip.id}`)
  } else {
    // No trips yet — send them to create their first destination
    redirect('/trip/new')
  }
}

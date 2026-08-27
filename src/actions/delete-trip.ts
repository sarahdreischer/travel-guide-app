'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { AuthService } from '@/lib/auth'
import { db } from '@/db'
import { trips } from '@/db/schema'
import { eq, and } from 'drizzle-orm'

/**
 * Delete a trip by ID. Requires the authenticated user to own the trip.
 * Redirects to /destinations after deletion.
 */
export async function deleteTripAction(tripId: string): Promise<void> {
  const cookieStore = await cookies()
  const token = cookieStore.get('session_token')?.value

  if (!token) redirect('/login')

  const user = await AuthService.getSession(token)
  if (!user) redirect('/login')

  // Only delete if the trip belongs to the current user
  await db
    .delete(trips)
    .where(and(eq(trips.id, tripId), eq(trips.userId, user.id)))

  redirect('/destinations')
}

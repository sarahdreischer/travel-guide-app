import { notFound } from 'next/navigation'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { AuthService } from '@/lib/auth'
import { db } from '@/db'
import { trips, destinationImages } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import TripForm from '@/components/forms/TripForm'

/**
 * Edit trip page — pre-populates the wizard with existing trip data.
 * Only accessible for upcoming trips (endDate >= today).
 */
export default async function EditTripPage({
  params,
}: {
  params: Promise<{ tripId: string }>
}) {
  const { tripId } = await params

  const cookieStore = await cookies()
  const token = cookieStore.get('session_token')?.value
  if (!token) redirect('/login')

  const user = await AuthService.getSession(token)
  if (!user) redirect('/login')

  // Fetch trip — must belong to this user
  const [trip] = await db
    .select()
    .from(trips)
    .where(and(eq(trips.id, tripId), eq(trips.userId, user.id)))
    .limit(1)

  if (!trip) notFound()

  // Only allow editing upcoming trips
  const today = new Date().toISOString().split('T')[0]
  if (trip.endDate < today) {
    redirect(`/home/${tripId}`)
  }

  // Fetch destination images
  const rows = await db.select().from(destinationImages)
  const imageMap: Record<string, string> = {}
  for (const row of rows) imageMap[row.destination] = row.imageUrl

  // Map DB trip to wizard form shape
  const initialData = {
    destination: trip.destination,
    startDate: trip.startDate,
    endDate: trip.endDate,
    party: trip.travelMode, // travelMode stores party type
    transportMode: trip.transportMode ?? '',
    budget: trip.budgetUsd > 0 ? String(trip.budgetUsd) : '',
    travelStyle: trip.travelStyle ? trip.travelStyle.split(',').map((s) => s.trim()) : [],
    activities: trip.activityPreferences ?? [],
  }

  return (
    <TripForm
      destinationImages={imageMap}
      editTripId={tripId}
      initialData={initialData}
      cancelHref={`/home/${tripId}`}
    />
  )
}

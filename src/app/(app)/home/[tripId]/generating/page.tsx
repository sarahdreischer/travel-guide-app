import { notFound } from 'next/navigation'
import { db } from '@/db'
import { trips } from '@/db/schema'
import { eq } from 'drizzle-orm'
import GeneratingClient from './GeneratingClient'

/**
 * "Generating advice" page — shows an animated loading experience
 * while AI answers are being fetched in the background.
 * Polls the advice-status API and redirects to the trip home once complete.
 */
export default async function GeneratingPage({
  params,
}: {
  params: Promise<{ tripId: string }>
}) {
  const { tripId } = await params

  const [trip] = await db.select().from(trips).where(eq(trips.id, tripId)).limit(1)
  if (!trip) notFound()

  return (
    <GeneratingClient
      tripId={tripId}
      destination={trip.destination}
    />
  )
}

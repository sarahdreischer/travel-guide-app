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
      // Hard cap on how long the loading screen waits before redirecting on
      // whatever is available. Raised from 15s so the preferred two-stage
      // structured guide (web research + model call) has a realistic chance to
      // land; the page still redirects on the legacy fallback if it doesn't.
      timeoutSeconds={parseInt(process.env.GENERATING_TRIP_ADVICE_TIMEOUT_SECONDS ?? '30', 10)}
    />
  )
}

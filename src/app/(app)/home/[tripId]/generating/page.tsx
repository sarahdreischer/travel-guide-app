import { notFound } from 'next/navigation'
import { db } from '@/db'
import { trips } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { TripGuideStore, tripGuideKeyForTrip } from '@/lib/trip-guide-store'
import { tripToGuideRequest } from '@/lib/trip-guide-request'
import { getOrGenerateTripGuideAction } from '@/actions/trip-guide'
import GeneratingClient from './GeneratingClient'

/**
 * "Generating advice" loading page — shows an animated loading experience
 * while the two-stage trip guide is produced in the background, polls the
 * advice-status API, and redirects to the trip home once ready.
 *
 * This page also KICKS OFF generation (fire-and-forget) so it works whether
 * the user arrived here from trip creation OR from opening an existing trip
 * that needs its guide (re)generated. Crucially, generation is NOT awaited —
 * the loading UI renders immediately and the client polls for completion, so
 * navigation never blocks on the LLM.
 */
export default async function GeneratingPage({
  params,
}: {
  params: Promise<{ tripId: string }>
}) {
  const { tripId } = await params

  const [trip] = await db.select().from(trips).where(eq(trips.id, tripId)).limit(1)
  if (!trip) notFound()

  // "update" when a guide already exists for this trip (we're refreshing/topping
  // it up), "new" when there's nothing yet. Drives the loading copy.
  const existing = await TripGuideStore.get(tripGuideKeyForTrip(trip))
  const mode: 'new' | 'update' = existing ? 'update' : 'new'

  // Kick off generation WITHOUT awaiting — the client polls for completion.
  // Failures are logged server-side by the action; the client's hard timeout
  // handles the case where it never completes.
  void getOrGenerateTripGuideAction(tripToGuideRequest(trip), 'high').catch(() => {
    // Swallowed: generation errors are logged in the action; the loading
    // screen will time out and send the user to the trip page regardless.
  })

  return (
    <GeneratingClient
      tripId={tripId}
      destination={trip.destination}
      mode={mode}
      // Hard cap on how long the loading screen waits before redirecting on
      // whatever is available. The two-stage guide (web research + per-topic
      // model calls) can take a while, so we give it a realistic window; the
      // client still redirects sooner the moment the guide is ready.
      timeoutSeconds={parseInt(process.env.GENERATING_TRIP_ADVICE_TIMEOUT_SECONDS ?? '30', 10)}
    />
  )
}

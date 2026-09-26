import { NextResponse } from 'next/server'
import { db } from '@/db'
import { trips } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { TripGuideStore, tripGuideKeyForTrip } from '@/lib/trip-guide-store'

/**
 * Trip-guide generation status for a trip. Polled by the "generating" page.
 *
 * The app uses ONLY the structured two-stage TripGuide, so completion is based
 * solely on whether that guide is ready. There is no legacy fallback.
 *
 * Response:
 *   {
 *     ready: 0 | 1,                     // 1 when the structured guide exists
 *     total: 1,                         // one deliverable: the trip guide
 *     complete: boolean,                // structured guide is ready
 *     structuredGuide: { status },      // 'ready' | 'pending'
 *     source: 'structured' | null       // what the home page will render
 *   }
 *
 * `ready`/`total`/`complete` are retained so existing pollers keep working, but
 * they now reflect the structured guide only.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const { tripId } = await params

  const [trip] = await db.select().from(trips).where(eq(trips.id, tripId)).limit(1)
  if (!trip) {
    return NextResponse.json({ error: 'Trip not found' }, { status: 404 })
  }

  let structuredReady = false
  try {
    structuredReady = await TripGuideStore.isReady(tripGuideKeyForTrip(trip))
  } catch {
    // Never let a lookup failure break the poll; the generating page has a hard
    // timeout so the user is never stuck.
    structuredReady = false
  }

  return NextResponse.json({
    total: 1,
    ready: structuredReady ? 1 : 0,
    complete: structuredReady,
    structuredGuide: { status: structuredReady ? 'ready' : 'pending' },
    source: structuredReady ? 'structured' : null,
  })
}

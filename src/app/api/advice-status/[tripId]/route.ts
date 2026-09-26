import { NextResponse } from 'next/server'
import { db } from '@/db'
import { trips } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { AdviceStore } from '@/lib/advice-store'
import { CATEGORIES, getSubQuestions } from '@/lib/destinations'
import { TripGuideStore, tripGuideKeyForTrip } from '@/lib/trip-guide-store'

/**
 * Advice-generation status for a trip. Polled by the "generating" page.
 *
 * The home page prefers the STRUCTURED two-stage TripGuide and falls back to
 * the legacy per-category advice. So this endpoint reports BOTH stages and an
 * overall `complete` that matches what the page will actually render:
 *
 *   complete = structured guide ready OR legacy advice fully cached
 *
 * That lets the generating page redirect as soon as either the preferred
 * structured guide is ready or the legacy fallback is complete — whichever
 * lands first — instead of redirecting on legacy readiness alone and then
 * having the structured guide pop in on a later refresh.
 *
 * Backward compatible: `total`, `ready`, and `complete` are still present.
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

  // ── Legacy per-category advice progress ────────────────────────────────────
  const records = await AdviceStore.getForTrip(tripId)
  const categoriesWithQuestions = CATEGORIES.filter((c) => getSubQuestions(c).length > 0)
  const total = categoriesWithQuestions.length
  const ready = records.length
  const legacyComplete = ready >= total

  // ── Structured two-stage TripGuide progress ─────────────────────────────────
  let structuredReady = false
  try {
    structuredReady = await TripGuideStore.isReady(tripGuideKeyForTrip(trip))
  } catch {
    // Never let a structured-guide lookup failure break the poll — fall back to
    // the legacy signal below.
    structuredReady = false
  }

  // Which source the home page will render right now (it prefers structured).
  const source: 'structured' | 'legacy' | null = structuredReady
    ? 'structured'
    : legacyComplete
      ? 'legacy'
      : null

  const complete = structuredReady || legacyComplete

  return NextResponse.json({
    // Legacy fields (unchanged contract)
    total,
    ready,
    complete,
    // New structured-guide status signal
    legacyComplete,
    structuredGuide: {
      status: structuredReady ? 'ready' : 'pending',
    },
    source,
  })
}

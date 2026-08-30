import Link from 'next/link'
import { notFound } from 'next/navigation'
import { cookies } from 'next/headers'
import { db } from '@/db'
import { trips, savedTips } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { AuthService } from '@/lib/auth'
import { AdviceStore, deriveMonthRange } from '@/lib/advice-store'
import type { AdviceRecord } from '@/lib/advice-store'
import { derivebudgetRange } from '@/lib/validators'
import { reconcileMissingAdviceAction, reconcileGroupTipsAction } from '@/actions/advice'
import { CATEGORIES, getSubQuestions } from '@/lib/destinations'
import { findAnswer } from '@/lib/answer-lookup'
import { fmtDateShort, fmtDate, nightCount } from '@/lib/format-date'
import { groupSections, type CategorySection } from '@/lib/category-groups'
import AdviceAccordion from '@/components/AdviceAccordion'
import DeleteTripButton from '@/components/DeleteTripButton'
import EditTripButton from '@/components/EditTripButton'
import AppFooter from '@/components/AppFooter'

// Re-exported for backward compatibility with existing importers.
export type { CategorySection }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function deriveSummary(text: string | undefined | null): string | null {
  if (!text) return null
  const match = text.match(/^[^.!?]*[.!?]/)
  return match ? match[0].trim() : text
}

function buildSections(adviceRecords: AdviceRecord[]): CategorySection[] {
  const byCategory = new Map<string, AdviceRecord>()
  for (const record of adviceRecords) byCategory.set(record.category, record)

  return CATEGORIES.map((category) => {
    const record = byCategory.get(category)
    const answers = record?.answers as Record<string, string> | null | undefined
    const subQuestions = getSubQuestions(category)

    // Fallback tip: derive a summary from the first available answer for this category
    const firstQuestion = subQuestions[0]
    const firstAnswer = firstQuestion ? findAnswer(answers ?? null, firstQuestion) ?? null : null

    return {
      category,
      conciseTip: deriveSummary(firstAnswer),
      answers: answers ?? null,
      subQuestions,
    }
  })
}

function IconArrowLeft() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 12H5M12 5l-7 7 7 7" />
    </svg>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function HomePage({
  params,
}: {
  params: Promise<{ tripId: string }>
}) {
  const { tripId } = await params

  const cookieStore = await cookies()
  const token = cookieStore.get('session_token')?.value
  const user = token ? await AuthService.getSession(token) : null

  const [trip] = await db.select().from(trips).where(eq(trips.id, tripId)).limit(1)
  if (!trip) notFound()

  // Fetch hero image (auto-fetches from Unsplash if missing, persists to DB)
  const { getDestinationImageWithAttribution } = await import('@/lib/destination-image')
  const { imageUrl: heroUrl, attribution: heroAttribution } = await getDestinationImageWithAttribution(trip.destination)

  // Fetch + reconcile advice
  let adviceRecords = await AdviceStore.getForTrip(tripId)
  const categoriesWithQuestions = CATEGORIES.filter((c) => getSubQuestions(c).length > 0)

  if (adviceRecords.length < categoriesWithQuestions.length) {
    const { startMonth, endMonth } = deriveMonthRange(trip.startDate, trip.endDate)
    await reconcileMissingAdviceAction({
      destination: trip.destination.toLowerCase(),
      startMonth,
      endMonth,
      travellerType: trip.travelMode.toLowerCase(),
      budgetRange: derivebudgetRange(trip.budgetUsd),
      transportMode: (trip as { transportMode?: string | null }).transportMode ?? undefined,
      startingLocation: (trip as { startingLocation?: string | null }).startingLocation ?? undefined,
      totalBudgetUsd: trip.budgetUsd,
      transportCostIncluded: (trip as { transportCostIncluded?: boolean }).transportCostIncluded ?? true,
      tripDurationDays: Math.max(1, Math.round((new Date(trip.endDate).getTime() - new Date(trip.startDate).getTime()) / 86400000)),
      partySize: trip.travelMode.toLowerCase(),
      activities: trip.activityPreferences,
    })
    adviceRecords = await AdviceStore.getForTrip(tripId)
  }

  const isPartial = adviceRecords.length < categoriesWithQuestions.length
  const sections = buildSections(adviceRecords)

  // ─── Generate group key tips via AI ────────────────────────────────────────
  // Group tips are stored in advice_cache with category = '_group_tips'
  const { startMonth: sm, endMonth: em } = deriveMonthRange(trip.startDate, trip.endDate)
  const cacheKey = {
    destination: trip.destination.toLowerCase(),
    startMonth: sm,
    endMonth: em,
    travellerType: trip.travelMode.toLowerCase(),
    budgetRange: derivebudgetRange(trip.budgetUsd),
    transportMode: (trip as { transportMode?: string | null }).transportMode ?? undefined,
    startingLocation: (trip as { startingLocation?: string | null }).startingLocation ?? undefined,
    totalBudgetUsd: trip.budgetUsd,
    transportCostIncluded: (trip as { transportCostIncluded?: boolean }).transportCostIncluded ?? true,
    tripDurationDays: Math.max(1, Math.round((new Date(trip.endDate).getTime() - new Date(trip.startDate).getTime()) / 86400000)),
    partySize: trip.travelMode.toLowerCase(),
    activities: trip.activityPreferences,
  }

  // Ensure group headline tips exist (generates + caches if missing/stale).
  // Shared with the manual and scheduled reconcilers.
  await reconcileGroupTipsAction(cacheKey)
  const groupTipRecord = await AdviceStore.findByCacheKey(cacheKey, '_group_tips')
  const groupTips: Record<string, string> = groupTipRecord
    ? (groupTipRecord.answers as Record<string, string>)
    : {}

  const groups = groupSections(sections, groupTips)

  const nights = nightCount(trip.startDate, trip.endDate)
  const detail = [
    `${fmtDateShort(trip.startDate)} – ${fmtDate(trip.endDate)}`,
    nights > 0 ? `${nights} night${nights !== 1 ? 's' : ''}` : null,
    trip.travelMode,
    trip.travelStyle,
    (trip as { transportMode?: string | null }).transportMode ?? null,
    trip.budgetUsd ? `$${trip.budgetUsd} Total Budget` : null,
  ]
    .filter(Boolean)
    .join('  ·  ')

  const isUpcoming = trip.endDate >= new Date().toISOString().split('T')[0]

  // Fetch saved tips for this trip
  const savedTipRows = user
    ? await db
        .select({ category: savedTips.category, question: savedTips.question })
        .from(savedTips)
        .where(and(eq(savedTips.userId, user.id), eq(savedTips.tripId, tripId)))
    : []
  const savedKeys = new Set(savedTipRows.map((r) => `${r.category}|${r.question}`))
  const savedCount = savedTipRows.length

  return (
    <>
      {/* Page header */}
      <header className="page-header" style={heroUrl ? { borderBottom: 'none' } : undefined}>
        <Link href="/destinations" className="page-header-btn" aria-label="Back to trips">
          <IconArrowLeft />
        </Link>
        <span className="page-title" style={{ fontSize: 15 }}>Travel advice</span>
        <div className="page-header-actions">
          {isUpcoming && <EditTripButton tripId={tripId} />}
          <DeleteTripButton tripId={tripId} destination={trip.destination} />
        </div>
      </header>

      {/* Hero banner or plain meta */}
      {heroUrl ? (
        <div className="trip-hero">
          <img
            className="trip-hero-img"
            src={heroUrl}
            alt={trip.destination}
            loading="eager"
          />
          <div className="trip-hero-scrim" aria-hidden="true" />
          <div className="trip-hero-meta">
            <p className="trip-hero-destination">{trip.destination}</p>
            <p className="trip-hero-detail">{detail}</p>
          </div>
          {heroAttribution && (
            <p className="trip-hero-attribution">
              Photo by <a href={`https://unsplash.com?utm_source=travel_guide&utm_medium=referral`} target="_blank" rel="noopener noreferrer">{heroAttribution}</a> on <a href="https://unsplash.com?utm_source=travel_guide&utm_medium=referral" target="_blank" rel="noopener noreferrer">Unsplash</a>
            </p>
          )}
        </div>
      ) : (
        <div className="trip-overview-meta">
          <p className="trip-overview-destination">{trip.destination}</p>
          <p className="trip-overview-detail">{detail}</p>
        </div>
      )}

      {isPartial && (
        <div className="advice-partial-banner">
          Some advice is still being generated — refresh to check for updates.
        </div>
      )}

      {/* 8 grouped rows + saved tips banner (managed by accordion) */}
      <AdviceAccordion groups={groups} tripId={tripId} savedKeys={savedKeys} initialSavedCount={savedCount} />

      <AppFooter />
    </>
  )
}

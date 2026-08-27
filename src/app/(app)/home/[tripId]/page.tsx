import Link from 'next/link'
import { notFound } from 'next/navigation'
import { cookies } from 'next/headers'
import { db } from '@/db'
import { trips, destinationImages, savedTips } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { AuthService } from '@/lib/auth'
import { AdviceStore, deriveMonthRange } from '@/lib/advice-store'
import type { AdviceRecord } from '@/lib/advice-store'
import { derivebudgetRange } from '@/lib/validators'
import { reconcileMissingAdviceAction } from '@/actions/advice'
import { CATEGORIES, CONCISE_TOPIC_MAPPING, type ConciseTopic, type Category, getSubQuestions } from '@/lib/destinations'
import { findAnswer } from '@/lib/answer-lookup'
import { fmtDateShort, fmtDate, nightCount } from '@/lib/format-date'
import { groupSections, getGroupQuestions } from '@/lib/category-groups'
import { LLMAdapter } from '@/lib/llm-adapter'
import AdviceAccordion from '@/components/AdviceAccordion'
import DeleteTripButton from '@/components/DeleteTripButton'
import EditTripButton from '@/components/EditTripButton'
import AppFooter from '@/components/AppFooter'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CategorySection {
  category: string
  conciseTip: string | null
  conciseTopic: string | null
  answers: Record<string, string> | null
  subQuestions: string[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const categoryToConciseTopic = new Map<string, ConciseTopic>(
  (Object.entries(CONCISE_TOPIC_MAPPING) as [ConciseTopic, { category: Category; question: string }][])
    .map(([topic, { category }]) => [category, topic])
)

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
    const conciseTopic = categoryToConciseTopic.get(category) ?? null
    const conciseQuestion = conciseTopic ? CONCISE_TOPIC_MAPPING[conciseTopic].question : null
    const conciseFullAnswer = conciseQuestion ? findAnswer(answers ?? null, conciseQuestion) ?? null : null

    return {
      category,
      conciseTip: deriveSummary(conciseFullAnswer),
      conciseTopic,
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

  // Fetch hero image (may be null for destinations without a stored image)
  const [heroRow] = await db
    .select()
    .from(destinationImages)
    .where(eq(destinationImages.destination, trip.destination))
    .limit(1)
  const heroUrl = heroRow?.imageUrl ?? null

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

  // Check if group tips are already cached
  const groupTipRecord = await AdviceStore.findByCacheKey(cacheKey, '_group_tips')
  let groupTips: Record<string, string> = {}

  if (groupTipRecord) {
    groupTips = groupTipRecord.answers as Record<string, string>
  } else {
    // Generate group tips via AI (non-blocking — if it fails we fall back to derived tips)
    const questions = getGroupQuestions()
    const aiTips = await LLMAdapter.generateGroupTips(cacheKey, questions)
    if (Object.keys(aiTips).length > 0) {
      // Cache for next visit
      await AdviceStore.save({
        destination: cacheKey.destination,
        startMonth: cacheKey.startMonth,
        endMonth: cacheKey.endMonth,
        travellerType: cacheKey.travellerType,
        budgetRange: cacheKey.budgetRange,
        category: '_group_tips',
        answers: aiTips,
      })
      groupTips = aiTips
    }
  }

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

      {/* Saved tips entry — shown when user has bookmarked tips */}
      {savedCount > 0 && (
        <div className="saved-tips-entry">
          <Link href={`/home/${tripId}/saved`} className="saved-tips-link">
            <span className="saved-tips-icon">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
              </svg>
            </span>
            <span className="saved-tips-label">Saved tips</span>
            <span className="saved-tips-count">{savedCount}</span>
          </Link>
        </div>
      )}

      {/* 8 grouped rows */}
      <AdviceAccordion groups={groups} tripId={tripId} savedKeys={savedKeys} />

      <AppFooter />
    </>
  )
}

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { cookies } from 'next/headers'
import { db } from '@/db'
import { trips } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { AuthService } from '@/lib/auth'
import { AdviceStore, deriveMonthRange } from '@/lib/advice-store'
import type { AdviceRecord } from '@/lib/advice-store'
import { derivebudgetRange } from '@/lib/validators'
import { reconcileMissingAdviceAction } from '@/actions/advice'
import { CATEGORIES, CONCISE_TOPIC_MAPPING, type ConciseTopic, type Category, getSubQuestions } from '@/lib/destinations'
import { findAnswer } from '@/lib/answer-lookup'
import { fmtDateShort, fmtDate, nightCount } from '@/lib/format-date'
import AdviceAccordion from '@/components/AdviceAccordion'

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
    })
    adviceRecords = await AdviceStore.getForTrip(tripId)
  }

  const sections = buildSections(adviceRecords)
  const isPartial = adviceRecords.length < categoriesWithQuestions.length

  const nights = nightCount(trip.startDate, trip.endDate)
  const dateRange = `${fmtDateShort(trip.startDate)} – ${fmtDate(trip.endDate)}`
  const detailParts = [
    dateRange,
    nights > 0 ? `${nights} night${nights !== 1 ? 's' : ''}` : null,
    trip.travelMode,
    trip.travelStyle,
    (trip as { transportMode?: string | null }).transportMode ?? null,
  ].filter(Boolean).join('  ·  ')

  return (
    <>
      {/* Page header — back to Trips list */}
      <header className="page-header">
        <Link href="/destinations" className="page-header-btn" aria-label="Back to trips">
          <IconArrowLeft />
        </Link>
        <span className="page-title" style={{ fontSize: 15 }}>Travel advice</span>
        <div style={{ width: 36 }} />
      </header>

      {/* Trip meta */}
      <div className="trip-overview-meta">
        <p className="trip-overview-destination">{trip.destination}</p>
        <p className="trip-overview-detail">{detailParts}</p>
      </div>

      {isPartial && (
        <div className="advice-partial-banner">
          Some advice is still being generated — refresh to check for updates.
        </div>
      )}

      {/* Numbered category list with inline accordion expansion */}
      <AdviceAccordion sections={sections} />
    </>
  )
}

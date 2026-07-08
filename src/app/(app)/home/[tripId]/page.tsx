// Home page for a specific trip — Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { cookies } from 'next/headers'
import { db } from '@/db'
import { trips } from '@/db/schema'
import { eq, desc } from 'drizzle-orm'
import { AuthService } from '@/lib/auth'
import { AdviceStore, deriveMonthRange } from '@/lib/advice-store'
import type { AdviceRecord } from '@/lib/advice-store'
import { derivebudgetRange } from '@/lib/validators'
import { reconcileMissingAdviceAction } from '@/actions/advice'
import { CATEGORIES, CONCISE_TOPICS, CONCISE_TOPIC_MAPPING, type ConciseTopic, getSubQuestions } from '@/lib/destinations'
import HomeCardGrid, { type CardData } from '@/components/HomeCardGrid'
import TripSelector from '@/components/TripSelector'

import { findAnswer } from '@/lib/answer-lookup'

/**
 * Derive a one-sentence summary from the full advice answer text.
 * Takes the first sentence (ending with . ! or ?) to avoid blocking the page
 * with 12 LLM calls. Falls back to the full text if no sentence boundary found.
 *
 * Requirements: 5.4, 5.6
 */
function deriveSummary(fullText: string | undefined | null): string | null {
  if (!fullText) return null
  const match = fullText.match(/^[^.!?]*[.!?]/)
  return match ? match[0].trim() : fullText
}

/**
 * Build CardData array by mapping topics to their advice records.
 */
function buildCards(adviceRecords: AdviceRecord[]): CardData[] {
  // Index advice records by category for quick lookup
  const byCategory = new Map<string, AdviceRecord>()
  for (const record of adviceRecords) {
    byCategory.set(record.category, record)
  }

  return CONCISE_TOPICS.map((topic) => {
    const mapping = CONCISE_TOPIC_MAPPING[topic]
    const record = byCategory.get(mapping.category)
    const answers = record?.answers as Record<string, string> | null | undefined
    const fullAnswer = findAnswer(answers, mapping.question) ?? null

    return {
      topic,
      summary: deriveSummary(fullAnswer),
      category: mapping.category,
      answers: answers ?? null,
    }
  })
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ tripId: string }>
}) {
  const { tripId } = await params

  // Get current user for trip list
  const cookieStore = await cookies()
  const token = cookieStore.get('session_token')?.value
  const user = token ? await AuthService.getSession(token) : null

  // Fetch the trip record for the heading
  const [trip] = await db.select().from(trips).where(eq(trips.id, tripId)).limit(1)

  if (!trip) {
    notFound()
  }

  // Fetch all user trips for the trip selector
  const userTrips = user
    ? await db
        .select({ id: trips.id, destination: trips.destination, startDate: trips.startDate, endDate: trips.endDate })
        .from(trips)
        .where(eq(trips.userId, user.id))
        .orderBy(desc(trips.createdAt))
    : []

  // Fetch all cached advice records for this trip
  const adviceRecords = await AdviceStore.getForTrip(tripId)

  // Only count categories that have sub-questions defined (exclude empty ones like "Local Etiquette")
  const categoriesWithQuestions = CATEGORIES.filter((c) => getSubQuestions(c).length > 0)
  const hasMissingAdvice = adviceRecords.length < categoriesWithQuestions.length

  if (hasMissingAdvice) {
    // Don't block the page — trigger reconciliation in background
    const { startMonth, endMonth } = deriveMonthRange(trip.startDate, trip.endDate)
    const cacheKey = {
      destination: trip.destination.toLowerCase(),
      startMonth,
      endMonth,
      travellerType: trip.travelMode.toLowerCase(),
      budgetRange: derivebudgetRange(trip.budgetUsd),
    }

    reconcileMissingAdviceAction(cacheKey).catch(() => {})
  }

  // Build card data from advice records
  const cards = buildCards(adviceRecords)

  return (
    <main className="p-4 max-w-4xl mx-auto">
      {/* Trip selector for users with multiple trips */}
      {userTrips.length > 1 && (
        <TripSelector
          trips={userTrips.map((t) => ({
            id: t.id,
            destination: t.destination,
            startDate: t.startDate,
            endDate: t.endDate,
          }))}
          currentTripId={tripId}
        />
      )}

      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        {trip.destination} — Key Tips
      </h1>

      {hasMissingAdvice && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Some advice is still being generated. Refresh to check for updates.
        </div>
      )}

      {/* Responsive grid of 12 Concise Cards — Req 5.1, 5.2 */}
      <HomeCardGrid cards={cards} />

      {/* Links — Req 5.7 and "Add new destination" */}
      <nav className="mt-8 flex flex-col sm:flex-row gap-4">
        <Link
          href={`/home/${tripId}/comprehensive`}
          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-center text-white font-medium hover:bg-blue-700 transition-colors"
        >
          View full advice
        </Link>
        <Link
          href="/trip/new"
          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-gray-300 px-4 py-2 text-center text-gray-700 font-medium hover:bg-gray-50 transition-colors"
        >
          Add new destination
        </Link>
      </nav>
    </main>
  )
}

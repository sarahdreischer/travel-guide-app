// Home page for a specific trip — Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { db } from '@/db'
import { trips } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { AdviceStore } from '@/lib/advice-store'
import type { AdviceRecord } from '@/lib/advice-store'
import HomeCardGrid, { type CardData } from '@/components/HomeCardGrid'
import { CONCISE_TOPICS, type ConciseTopic } from '@/lib/destinations'

/**
 * Mapping from the 12 Concise Card topics to (category, sub-question) pairs.
 * Each topic extracts its answer from the relevant category's answers JSONB field.
 */
const TOPIC_MAPPING: Record<ConciseTopic, { category: string; question: string }> = {
  'Rental car': {
    category: 'Transportation – Self Driving',
    question: 'Is rental car recommended?',
  },
  'Parking': {
    category: 'Transportation – Self Driving',
    question: 'Is parking easy?',
  },
  'Public transport': {
    category: 'Transportation – Public Transport',
    question: 'Is public transport sufficient?',
  },
  'Laundry': {
    category: 'Laundry',
    question: 'Are there self-service laundrettes?',
  },
  'Airport transport': {
    category: 'Transportation – Serviced',
    question: 'Should I book airport transport in advance?',
  },
  'Mobile data': {
    category: 'Connectivity',
    question: 'How reliable is mobile data?',
  },
  'Cash needed': {
    category: 'Budget & Money',
    question: 'Do I need to bring cash?',
  },
  'Tipping expected': {
    category: 'Food',
    question: 'Is tipping expected?',
  },
  'Where to eat': {
    category: 'Food',
    question: 'Where do locals eat?',
  },
  'Weather conditions': {
    category: 'Weather',
    question: 'Are rain showers common?',
  },
  'Safety rating': {
    category: 'Safety',
    question: 'Is it safe for solo travellers?',
  },
  'Mosquitos expected': {
    category: 'Packing',
    question: 'Do I need insect repellent?',
  },
}

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
    const mapping = TOPIC_MAPPING[topic]
    const record = byCategory.get(mapping.category)
    const answers = record?.answers as Record<string, string> | null | undefined
    const fullAnswer = answers?.[mapping.question] ?? null

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

  // Fetch the trip record for the heading
  const [trip] = await db.select().from(trips).where(eq(trips.id, tripId)).limit(1)

  if (!trip) {
    notFound()
  }

  // Fetch all cached advice records for this trip
  const adviceRecords = await AdviceStore.getForTrip(tripId)

  // Build card data from advice records
  const cards = buildCards(adviceRecords)

  return (
    <main className="p-4 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        {trip.destination} — Travel Advice
      </h1>

      {/* Responsive grid of 12 Concise Cards — Req 5.1, 5.2 */}
      <HomeCardGrid cards={cards} />

      {/* Links — Req 5.7 and "Add new destination" */}
      <nav className="mt-8 flex flex-col sm:flex-row gap-4">
        <Link
          href={`/home/${tripId}/comprehensive`}
          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-center text-white font-medium hover:bg-blue-700 transition-colors"
        >
          View Comprehensive Advice
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

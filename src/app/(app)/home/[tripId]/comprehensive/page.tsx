import Link from 'next/link'
import { notFound } from 'next/navigation'
import { db } from '@/db'
import { trips } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { AdviceStore, deriveMonthRange } from '@/lib/advice-store'
import { CATEGORIES, type Category, getSubQuestions } from '@/lib/destinations'
import { derivebudgetRange } from '@/lib/validators'
import { reconcileMissingAdviceAction } from '@/actions/advice'
import { findAnswer } from '@/lib/answer-lookup'

/**
 * Comprehensive Advice page — shows ALL categories with their full Q&A
 * in a structured table format.
 */
export default async function ComprehensivePage({
  params,
}: {
  params: Promise<{ tripId: string }>
}) {
  const { tripId } = await params

  const [trip] = await db.select().from(trips).where(eq(trips.id, tripId)).limit(1)
  if (!trip) notFound()

  // Fetch cached advice
  let adviceRecords = await AdviceStore.getForTrip(tripId)

  // Reconcile missing categories (awaited so data is available on render)
  const categoriesWithQuestions = CATEGORIES.filter((c) => getSubQuestions(c).length > 0)
  if (adviceRecords.length < categoriesWithQuestions.length) {
    const { startMonth, endMonth } = deriveMonthRange(trip.startDate, trip.endDate)
    const cacheKey = {
      destination: trip.destination.toLowerCase(),
      startMonth,
      endMonth,
      travellerType: trip.travelMode.toLowerCase(),
      budgetRange: derivebudgetRange(trip.budgetUsd),
    }
    await reconcileMissingAdviceAction(cacheKey)
    adviceRecords = await AdviceStore.getForTrip(tripId)
  }

  // Index by category
  const byCategory = new Map<string, Record<string, string>>()
  for (const record of adviceRecords) {
    byCategory.set(record.category, record.answers as Record<string, string>)
  }

  return (
    <main className="p-4 max-w-5xl mx-auto">
      <div className="mb-6">
        <Link
          href={`/home/${tripId}`}
          className="text-sm text-blue-600 hover:text-blue-500"
        >
          ← Back to overview
        </Link>
      </div>

      <h1 className="text-2xl font-bold text-gray-900 mb-2">
        {trip.destination} — Full Travel Advice
      </h1>
      <p className="text-sm text-gray-600 mb-8">
        {trip.startDate} to {trip.endDate} · {trip.travelMode} · {trip.travelStyle}
      </p>

      <div className="space-y-10">
        {CATEGORIES.map((category) => {
          const answers = byCategory.get(category)
          const subQuestions = getSubQuestions(category as Category)

          return (
            <section key={category} id={category.toLowerCase().replace(/\s+/g, '-')}>
              <h2 className="text-lg font-semibold text-gray-900 mb-3 border-b border-gray-200 pb-2">
                {category}
              </h2>

              {subQuestions.length === 0 ? (
                <p className="text-sm text-gray-500 italic">No questions defined for this category yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="text-left py-2 px-3 font-medium text-gray-700 w-2/5 border-b">
                          Question
                        </th>
                        <th className="text-left py-2 px-3 font-medium text-gray-700 w-3/5 border-b">
                          Answer
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {subQuestions.map((question) => {
                        const answer = findAnswer(answers, question)
                        return (
                          <tr key={question} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="py-2 px-3 text-gray-800 font-medium align-top">
                              {question}
                            </td>
                            <td className="py-2 px-3 text-gray-600">
                              {answer || <span className="italic text-gray-400">Not available</span>}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )
        })}
      </div>

      {/* Quick nav */}
      <nav className="mt-12 border-t border-gray-200 pt-6">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Jump to category</h3>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => (
            <a
              key={cat}
              href={`#${cat.toLowerCase().replace(/\s+/g, '-')}`}
              className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-700 hover:bg-blue-50 hover:text-blue-700"
            >
              {cat}
            </a>
          ))}
        </div>
      </nav>
    </main>
  )
}

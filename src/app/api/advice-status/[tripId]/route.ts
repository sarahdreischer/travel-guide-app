import { NextResponse } from 'next/server'
import { AdviceStore } from '@/lib/advice-store'
import { CATEGORIES, getSubQuestions } from '@/lib/destinations'

/**
 * API route to check how many categories have advice cached for a trip.
 * Used by the "generating" page to poll for completion.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const { tripId } = await params
  const records = await AdviceStore.getForTrip(tripId)

  // Only count categories that have sub-questions defined
  const categoriesWithQuestions = CATEGORIES.filter((c) => getSubQuestions(c).length > 0)

  return NextResponse.json({
    total: categoriesWithQuestions.length,
    ready: records.length,
    complete: records.length >= categoriesWithQuestions.length,
  })
}

'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { AuthService } from '@/lib/auth'
import { db } from '@/db'
import { savedTips } from '@/db/schema'
import { eq, and } from 'drizzle-orm'

/**
 * Toggle a saved tip. If it exists, remove it. If not, add it.
 * Returns the new saved state.
 */
export async function toggleSavedTipAction(params: {
  tripId: string
  category: string
  question: string
  answer: string
}): Promise<{ saved: boolean }> {
  const cookieStore = await cookies()
  const token = cookieStore.get('session_token')?.value
  if (!token) redirect('/login')

  const user = await AuthService.getSession(token)
  if (!user) redirect('/login')

  const { tripId, category, question, answer } = params

  // Check if already saved
  const [existing] = await db
    .select({ id: savedTips.id })
    .from(savedTips)
    .where(
      and(
        eq(savedTips.userId, user.id),
        eq(savedTips.tripId, tripId),
        eq(savedTips.category, category),
        eq(savedTips.question, question),
      )
    )
    .limit(1)

  if (existing) {
    // Remove
    await db.delete(savedTips).where(eq(savedTips.id, existing.id))
    return { saved: false }
  } else {
    // Add
    await db.insert(savedTips).values({
      userId: user.id,
      tripId,
      category,
      question,
      answer,
    }).onConflictDoNothing()
    return { saved: true }
  }
}

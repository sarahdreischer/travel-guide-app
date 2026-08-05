'use server'

import { db } from '@/db'
import { votes } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { validateExperienceNote } from '@/lib/validators'
import { cookies } from 'next/headers'
import { AuthService } from '@/lib/auth'

// ─── Types ────────────────────────────────────────────────────────────────────

export type VoteActionResult = { success: true } | { success: false; error: string }

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getCurrentUserId(): Promise<string | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('session_token')?.value
  if (!token) return null
  const user = await AuthService.getSession(token)
  return user?.id ?? null
}

// ─── Actions ──────────────────────────────────────────────────────────────────

/**
 * Cast a new vote on an advice answer that the user has not previously voted on.
 * Requirements: 7.2
 */
export async function castVoteAction(
  adviceId: string,
  voteType: 'accurate' | 'outdated'
): Promise<VoteActionResult> {
  const userId = await getCurrentUserId()
  if (!userId) {
    return { success: false, error: 'You must be logged in to vote.' }
  }

  // Check for existing vote
  const [existing] = await db
    .select()
    .from(votes)
    .where(and(eq(votes.userId, userId), eq(votes.adviceId, adviceId)))
    .limit(1)

  if (existing) {
    return { success: false, error: 'You have already voted on this advice.' }
  }

  await db.insert(votes).values({
    userId,
    adviceId,
    voteType,
  })

  return { success: true }
}

/**
 * Change an existing vote to a new vote type.
 * Requirements: 7.5, 7.6
 */
export async function changeVoteAction(
  adviceId: string,
  newVoteType: 'accurate' | 'outdated'
): Promise<VoteActionResult> {
  const userId = await getCurrentUserId()
  if (!userId) {
    return { success: false, error: 'You must be logged in to change your vote.' }
  }

  await db
    .update(votes)
    .set({
      voteType: newVoteType,
      updatedAt: new Date(),
    })
    .where(and(eq(votes.userId, userId), eq(votes.adviceId, adviceId)))

  return { success: true }
}

/**
 * Retract (delete) an existing vote.
 * Requirements: 7.5, 7.7
 */
export async function retractVoteAction(
  adviceId: string
): Promise<VoteActionResult> {
  const userId = await getCurrentUserId()
  if (!userId) {
    return { success: false, error: 'You must be logged in to retract your vote.' }
  }

  await db
    .delete(votes)
    .where(and(eq(votes.userId, userId), eq(votes.adviceId, adviceId)))

  return { success: true }
}

/**
 * Add or update an experience note on an advice answer.
 * The note can be submitted independently of a vote (Req 7.3).
 * If no vote row exists, a row with voteType 'none' is created.
 * Requirements: 7.3, 7.4, 7.8
 */
export async function addExperienceNoteAction(
  adviceId: string,
  note: string
): Promise<VoteActionResult> {
  const userId = await getCurrentUserId()
  if (!userId) {
    return { success: false, error: 'You must be logged in to add a note.' }
  }

  // Validate note length (1–500 chars)
  if (!validateExperienceNote(note)) {
    return {
      success: false,
      error: 'Experience note must be between 1 and 500 characters.',
    }
  }

  // Check for existing vote/note row
  const [existing] = await db
    .select()
    .from(votes)
    .where(and(eq(votes.userId, userId), eq(votes.adviceId, adviceId)))
    .limit(1)

  if (existing) {
    // Update existing row with the note
    await db
      .update(votes)
      .set({
        experienceNote: note,
        updatedAt: new Date(),
      })
      .where(and(eq(votes.userId, userId), eq(votes.adviceId, adviceId)))
  } else {
    // Insert new row with voteType 'none' to support notes without a vote
    await db.insert(votes).values({
      userId,
      adviceId,
      voteType: 'none',
      experienceNote: note,
    })
  }

  return { success: true }
}

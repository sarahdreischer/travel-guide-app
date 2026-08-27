import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { db } from '@/db'
import { trips, savedTips } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { AuthService } from '@/lib/auth'
import SavedTipsList from '@/components/SavedTipsList'
import AppFooter from '@/components/AppFooter'

function IconArrowLeft() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 12H5M12 5l-7 7 7 7" />
    </svg>
  )
}

export default async function SavedTipsPage({
  params,
}: {
  params: Promise<{ tripId: string }>
}) {
  const { tripId } = await params

  const cookieStore = await cookies()
  const token = cookieStore.get('session_token')?.value
  if (!token) redirect('/login')

  const user = await AuthService.getSession(token)
  if (!user) redirect('/login')

  const [trip] = await db.select().from(trips).where(eq(trips.id, tripId)).limit(1)
  if (!trip) notFound()

  // Fetch all saved tips for this trip
  const tips = await db
    .select()
    .from(savedTips)
    .where(and(eq(savedTips.userId, user.id), eq(savedTips.tripId, tripId)))

  // Group by category
  const grouped = new Map<string, Array<{ id: string; question: string; answer: string }>>()
  for (const tip of tips) {
    const list = grouped.get(tip.category) ?? []
    list.push({ id: tip.id, question: tip.question, answer: tip.answer })
    grouped.set(tip.category, list)
  }

  return (
    <>
      <header className="page-header">
        <Link href={`/home/${tripId}`} className="page-header-btn" aria-label="Back to travel advice">
          <IconArrowLeft />
        </Link>
        <span className="page-title" style={{ fontSize: 15 }}>Saved tips</span>
        <div style={{ width: 36 }} />
      </header>

      <div className="page-body">
        {tips.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state-text">
              No tips saved yet. Tap the bookmark icon on any piece of advice to save it here.
            </p>
          </div>
        ) : (
          <SavedTipsList tripId={tripId} grouped={Object.fromEntries(grouped)} />
        )}
        <AppFooter />
      </div>
    </>
  )
}

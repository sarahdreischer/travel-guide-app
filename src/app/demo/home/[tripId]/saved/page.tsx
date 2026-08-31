import Link from 'next/link'
import { notFound } from 'next/navigation'
import { DEMO_TRIPS, getDemoTrip } from '@/lib/demo-data'
import AppFooter from '@/components/AppFooter'

export const metadata = {
  title: 'Demo · Saved tips – Trip Guide',
}

export function generateStaticParams() {
  return DEMO_TRIPS.map((t) => ({ tripId: t.id }))
}

function IconArrowLeft() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 12H5M12 5l-7 7 7 7" />
    </svg>
  )
}

export default async function DemoSavedPage({
  params,
}: {
  params: Promise<{ tripId: string }>
}) {
  const { tripId } = await params
  const trip = getDemoTrip(tripId)
  if (!trip) notFound()

  return (
    <>
      <header className="page-header">
        <Link href={`/demo/home/${tripId}`} className="page-header-btn" aria-label="Back to travel briefing">
          <IconArrowLeft />
        </Link>
        <span className="page-title" style={{ fontSize: 15 }}>Saved tips</span>
        <span className="demo-badge" aria-label="Demo mode">Demo</span>
      </header>

      <div className="page-body">
        <div className="empty-state" style={{ borderTop: 'none' }}>
          <p className="empty-state-text">
            In the demo, saved tips aren&apos;t stored between visits. Sign in to bookmark
            advice and keep it with your trip.
          </p>
          <Link href="/login" className="empty-state-btn">
            Sign in to save tips
          </Link>
          <div style={{ height: 12 }} />
          <Link href={`/demo/home/${tripId}`} className="auth-toggle-link">
            Back to travel briefing
          </Link>
        </div>
        <AppFooter />
      </div>
    </>
  )
}

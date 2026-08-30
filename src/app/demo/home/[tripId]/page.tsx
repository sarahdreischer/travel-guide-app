import Link from 'next/link'
import { notFound } from 'next/navigation'
import { fmtDateShort, fmtDate, nightCount } from '@/lib/format-date'
import { groupSections } from '@/lib/category-groups'
import { DEMO_TRIPS, getDemoTrip, getDemoHero, buildDemoSections, buildDemoGroupTips } from '@/lib/demo-data'
import AdviceAccordion from '@/components/AdviceAccordion'
import AppFooter from '@/components/AppFooter'

export const metadata = {
  title: 'Demo · Travel advice – Travel Guide',
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

export default async function DemoHomePage({
  params,
}: {
  params: Promise<{ tripId: string }>
}) {
  const { tripId } = await params

  const trip = getDemoTrip(tripId)
  if (!trip) notFound()

  const { imageUrl: heroUrl, attribution: heroAttribution } = getDemoHero(tripId)

  // Build static advice + group tips (derived from live category config).
  const sections = buildDemoSections(trip.destination)
  const groupTips = buildDemoGroupTips(trip.destination)
  const groups = groupSections(sections, groupTips)

  const nights = nightCount(trip.startDate, trip.endDate)
  const detail = [
    `${fmtDateShort(trip.startDate)} – ${fmtDate(trip.endDate)}`,
    nights > 0 ? `${nights} night${nights !== 1 ? 's' : ''}` : null,
    trip.travelMode,
    trip.travelStyle,
    trip.transportMode,
    trip.budgetUsd ? `$${trip.budgetUsd} Total Budget` : null,
  ]
    .filter(Boolean)
    .join('  ·  ')

  return (
    <>
      {/* Page header */}
      <header className="page-header" style={heroUrl ? { borderBottom: 'none' } : undefined}>
        <Link href="/demo/destinations" className="page-header-btn" aria-label="Back to trips">
          <IconArrowLeft />
        </Link>
        <span className="page-title" style={{ fontSize: 15 }}>Travel advice</span>
        <span className="demo-badge" aria-label="Demo mode">Demo</span>
      </header>

      {/* Hero banner */}
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
          {heroAttribution && (
            <p className="trip-hero-attribution">
              Photo by <a href="https://unsplash.com?utm_source=travel_guide&utm_medium=referral" target="_blank" rel="noopener noreferrer">{heroAttribution}</a> on <a href="https://unsplash.com?utm_source=travel_guide&utm_medium=referral" target="_blank" rel="noopener noreferrer">Unsplash</a>
            </p>
          )}
        </div>
      ) : (
        <div className="trip-overview-meta">
          <p className="trip-overview-destination">{trip.destination}</p>
          <p className="trip-overview-detail">{detail}</p>
        </div>
      )}

      {/* Grouped advice — demo mode: bookmarks are client-side only */}
      <AdviceAccordion
        groups={groups}
        tripId={tripId}
        savedKeys={new Set()}
        initialSavedCount={0}
        basePath="/demo"
        demoMode
      />

      <AppFooter />
    </>
  )
}

import Link from 'next/link'
import Image from 'next/image'
import { fmtDateShort, fmtDate, nightCount, relativeTime } from '@/lib/format-date'
import { DEMO_TRIPS } from '@/lib/demo-data'
import SwipeTripRow from '@/components/SwipeTripRow'
import AppFooter from '@/components/AppFooter'

export const metadata = {
  title: 'Demo · Trips – Trip Guide',
}

function IconChevronRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 18l6-6-6-6" />
    </svg>
  )
}

export default function DemoDestinationsPage() {
  const today = new Date().toISOString().split('T')[0]
  const upcomingTrips = DEMO_TRIPS.filter((t) => t.endDate >= today)
  const pastTrips = DEMO_TRIPS.filter((t) => t.endDate < today)

  return (
    <>
      <header className="page-header">
        <h1 className="page-title">Trips</h1>
        <div className="page-brand">
          <Image src="/app-icon.png" alt="" width={22} height={22} className="page-brand-icon" aria-hidden="true" />
          <span className="page-brand-label">Trip Guide</span>
        </div>
        <span className="demo-badge" aria-label="Demo mode">Demo</span>
      </header>

      <div className="page-body">
        <span className="section-label">Upcoming</span>

        <div className="trip-list">
          {upcomingTrips.map((trip) => {
            const nights = nightCount(trip.startDate, trip.endDate)
            const relative = relativeTime(trip.startDate, trip.endDate)
            const meta = [
              `${fmtDateShort(trip.startDate)} – ${fmtDate(trip.endDate)}`,
              nights > 0 ? `${nights} night${nights !== 1 ? 's' : ''}` : null,
              trip.travelMode || null,
              trip.travelStyle || null,
            ].filter(Boolean).join('  ·  ')

            return (
              <SwipeTripRow
                key={trip.id}
                tripId={trip.id}
                destination={trip.destination}
                href={`/demo/home/${trip.id}`}
                disableDelete
              >
                <div className="trip-row-top">
                  <span className="trip-row-destination">{trip.destination}</span>
                  <span className="trip-row-time is-soon">{relative}</span>
                </div>
                <p className="trip-row-meta">{meta}</p>
                <span className="trip-row-chevron" aria-hidden="true">
                  <IconChevronRight />
                </span>
              </SwipeTripRow>
            )
          })}
        </div>

        {pastTrips.length > 0 && (
          <>
            <span className="section-label" style={{ marginTop: 24, display: 'block' }}>Past</span>
            <div className="trip-list">
              {pastTrips.map((trip) => {
                const nights = nightCount(trip.startDate, trip.endDate)
                const relative = relativeTime(trip.startDate, trip.endDate)
                const meta = [
                  `${fmtDateShort(trip.startDate)} – ${fmtDate(trip.endDate)}`,
                  nights > 0 ? `${nights} night${nights !== 1 ? 's' : ''}` : null,
                  trip.travelMode || null,
                  trip.travelStyle || null,
                ].filter(Boolean).join('  ·  ')

                return (
                  <SwipeTripRow
                    key={trip.id}
                    tripId={trip.id}
                    destination={trip.destination}
                    href={`/demo/home/${trip.id}`}
                    isPast
                    disableDelete
                  >
                    <div className="trip-row-top">
                      <span className="trip-row-destination">{trip.destination}</span>
                      <span className="trip-row-time">{relative}</span>
                    </div>
                    <p className="trip-row-meta">{meta}</p>
                    <span className="trip-row-chevron" aria-hidden="true">
                      <IconChevronRight />
                    </span>
                  </SwipeTripRow>
                )
              })}
            </div>
          </>
        )}

        <div style={{ height: 32 }} />
        <AppFooter />
      </div>
    </>
  )
}

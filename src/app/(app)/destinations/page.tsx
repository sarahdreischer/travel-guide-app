import Link from 'next/link'
import Image from 'next/image'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { AuthService } from '@/lib/auth'
import { db } from '@/db'
import { trips } from '@/db/schema'
import { eq, desc } from 'drizzle-orm'
import { fmtDateShort, fmtDate, nightCount, relativeTime } from '@/lib/format-date'
import SwipeTripRow from '@/components/SwipeTripRow'
import AppFooter from '@/components/AppFooter'

function IconPlus() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

function IconChevronRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 18l6-6-6-6" />
    </svg>
  )
}

export default async function DestinationsPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('session_token')?.value
  if (!token) redirect('/login')

  const user = await AuthService.getSession(token)
  if (!user) redirect('/login')

  const userTrips = await db
    .select()
    .from(trips)
    .where(eq(trips.userId, user.id))
    .orderBy(desc(trips.startDate))

  const today = new Date().toISOString().split('T')[0]
  const upcomingTrips = userTrips.filter((t) => t.endDate >= today)
  const pastTrips = userTrips.filter((t) => t.endDate < today)

  return (
    <>
      <header className="page-header">
        <h1 className="page-title">Trips</h1>
        <div className="page-brand">
          <Image src="/app-icon.png" alt="" width={22} height={22} className="page-brand-icon" aria-hidden="true" />
          <span className="page-brand-label">Trip Guide</span>
        </div>
        <Link href="/trip/new" className="page-header-add" aria-label="Add a trip">
          <IconPlus />
        </Link>
      </header>

      <div className="page-body">
        <span className="section-label">Upcoming</span>

        {upcomingTrips.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state-text">
              No trips planned yet. Add your first destination to get personalised travel briefing.
            </p>
            <Link href="/trip/new" className="empty-state-btn">
              <IconPlus />
              Plan a trip
            </Link>
          </div>
        ) : (
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
                  href={`/home/${trip.id}`}
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
        )}

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
                    href={`/home/${trip.id}`}
                    isPast
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

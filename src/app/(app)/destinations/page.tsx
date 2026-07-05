// Travel Destinations page — Requirements 8.1, 8.2, 8.3, 8.4
import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { AuthService } from '@/lib/auth'
import { db } from '@/db'
import { trips } from '@/db/schema'
import { eq } from 'drizzle-orm'

export default async function DestinationsPage() {
  // Get current user from session cookie
  const cookieStore = await cookies()
  const token = cookieStore.get('session_token')?.value

  if (!token) {
    redirect('/login')
  }

  const user = await AuthService.getSession(token)

  if (!user) {
    redirect('/login')
  }

  // Query all trips for the current user
  const userTrips = await db
    .select()
    .from(trips)
    .where(eq(trips.userId, user.id))

  // Split into upcoming and past based on end_date vs today
  const today = new Date().toISOString().split('T')[0] // "YYYY-MM-DD"

  const upcomingTrips = userTrips.filter((trip) => trip.endDate >= today)
  const pastTrips = userTrips.filter((trip) => trip.endDate < today)

  return (
    <main className="p-4 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        Travel Destinations
      </h1>

      {/* Add new destination link */}
      <Link
        href="/trip/new"
        className="inline-flex min-h-[44px] min-w-[44px] items-center rounded-lg bg-blue-600 px-4 py-2 text-white font-medium hover:bg-blue-700 transition-colors"
      >
        Add new destination
      </Link>

      {/* Upcoming destinations section */}
      <section className="mt-8">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">
          Upcoming destinations
        </h2>

        {upcomingTrips.length > 0 ? (
          <ul className="space-y-2">
            {upcomingTrips.map((trip) => (
              <li key={trip.id}>
                <Link
                  href={`/home/${trip.id}`}
                  className="block rounded-lg border border-gray-200 px-4 py-3 min-h-[44px] hover:bg-gray-50 transition-colors overflow-hidden"
                >
                  <span className="block font-medium text-gray-900 truncate">
                    {trip.destination}
                  </span>
                  <span className="block text-sm text-gray-600">
                    {trip.startDate} — {trip.endDate}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-600">
            No upcoming trips. Plan your next adventure!{' '}
            <Link
              href="/trip/new"
              className="inline-flex min-h-[44px] min-w-[44px] items-center text-blue-600 underline hover:text-blue-700"
            >
              Create a trip
            </Link>
          </p>
        )}
      </section>

      {/* Past destinations section */}
      <section className="mt-8">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">
          Past destinations
        </h2>

        {pastTrips.length > 0 ? (
          <ul className="space-y-2">
            {pastTrips.map((trip) => (
              <li key={trip.id}>
                <Link
                  href={`/home/${trip.id}`}
                  className="block rounded-lg border border-gray-200 px-4 py-3 min-h-[44px] hover:bg-gray-50 transition-colors overflow-hidden"
                >
                  <span className="block font-medium text-gray-900 truncate">
                    {trip.destination}
                  </span>
                  <span className="block text-sm text-gray-600">
                    {trip.startDate} — {trip.endDate}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-600">No past trips yet.</p>
        )}
      </section>
    </main>
  )
}

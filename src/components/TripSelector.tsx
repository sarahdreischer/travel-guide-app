'use client'

import { useRouter } from 'next/navigation'

interface TripSelectorProps {
  trips: { id: string; destination: string; startDate: string }[]
  currentTripId: string
}

/**
 * Client component for switching between trips on the home page.
 * Renders a select dropdown that navigates to the selected trip's home page.
 */
export default function TripSelector({ trips, currentTripId }: TripSelectorProps) {
  const router = useRouter()

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const selectedTripId = e.target.value
    if (selectedTripId !== currentTripId) {
      router.push(`/home/${selectedTripId}`)
    }
  }

  return (
    <div className="mb-4">
      <label htmlFor="trip-selector" className="block text-sm font-medium text-gray-700 mb-1">
        Switch trip
      </label>
      <select
        id="trip-selector"
        value={currentTripId}
        onChange={handleChange}
        className="block w-full min-h-[44px] min-w-[44px] rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      >
        {trips.map((trip) => (
          <option key={trip.id} value={trip.id}>
            {trip.destination} ({trip.startDate})
          </option>
        ))}
      </select>
    </div>
  )
}

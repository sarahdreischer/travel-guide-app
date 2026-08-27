import { DESTINATIONS } from '@/lib/destinations'
import { getDestinationImages } from '@/lib/destination-image'
import TripForm from '@/components/forms/TripForm'

/**
 * New trip page — fetches destination images (from DB cache or Unsplash) and passes to wizard.
 */
export default async function NewTripPage() {
  // Get images for all destinations (cached in DB, auto-fetched if missing)
  const imageMap = await getDestinationImages([...DESTINATIONS])

  return <TripForm destinationImages={imageMap} />
}

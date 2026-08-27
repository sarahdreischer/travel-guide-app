import { DESTINATIONS } from '@/lib/destinations'
import { getDestinationImagesWithAttribution } from '@/lib/destination-image'
import TripForm from '@/components/forms/TripForm'

/**
 * New trip page — fetches destination images (from DB cache or Unsplash) and passes to wizard.
 */
export default async function NewTripPage() {
  // Get images + attribution for all destinations (cached in DB, auto-fetched if missing)
  const imageData = await getDestinationImagesWithAttribution([...DESTINATIONS])

  const imageMap: Record<string, string> = {}
  const attributionMap: Record<string, string | null> = {}
  for (const [dest, info] of Object.entries(imageData)) {
    imageMap[dest] = info.imageUrl
    attributionMap[dest] = info.attribution
  }

  return <TripForm destinationImages={imageMap} destinationAttributions={attributionMap} />
}

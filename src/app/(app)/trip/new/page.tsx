import { db } from '@/db'
import { destinationImages } from '@/db/schema'
import TripForm from '@/components/forms/TripForm'

/**
 * New trip page — fetches destination images from DB and passes to wizard.
 */
export default async function NewTripPage() {
  // Fetch all destination image URLs for the reveal + summary hero
  const rows = await db.select().from(destinationImages)
  const imageMap: Record<string, string> = {}
  for (const row of rows) {
    imageMap[row.destination] = row.imageUrl
  }

  return <TripForm destinationImages={imageMap} />
}

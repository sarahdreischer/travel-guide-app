/**
 * Destination image fetcher — retrieves a relevant photo from Unsplash for a
 * destination and persists it in the `destination_images` table.
 *
 * Requires UNSPLASH_ACCESS_KEY in environment variables.
 * Free tier: 50 requests/hour.
 *
 * Docs: https://unsplash.com/documentation#search-photos
 */

import { db } from '@/db'
import { destinationImages } from '@/db/schema'
import { eq } from 'drizzle-orm'

const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1498637841888-108c6b723fcb?w=1080&q=80&fit=crop'

/**
 * Get the image URL for a destination.
 * 1. Check DB cache
 * 2. If missing, fetch from Unsplash and persist
 * 3. Fallback to generic travel image if Unsplash fails
 */
export async function getDestinationImage(destination: string): Promise<string> {
  const result = await getDestinationImageWithAttribution(destination)
  return result.imageUrl
}

/**
 * Get image URL and photographer attribution for a destination.
 */
export async function getDestinationImageWithAttribution(destination: string): Promise<{
  imageUrl: string
  attribution: string | null
  unsplashProfileUrl: string | null
}> {
  // 1. Check DB
  const [existing] = await db
    .select()
    .from(destinationImages)
    .where(eq(destinationImages.destination, destination))
    .limit(1)

  if (existing) {
    return {
      imageUrl: existing.imageUrl,
      attribution: existing.attribution,
      unsplashProfileUrl: existing.attribution
        ? `https://unsplash.com/@${existing.attribution.toLowerCase().replace(/\s+/g, '')}?utm_source=travel_guide&utm_medium=referral`
        : null,
    }
  }

  // 2. Fetch from Unsplash
  const accessKey = process.env.UNSPLASH_ACCESS_KEY
  if (!accessKey) {
    console.warn('[destination-image] UNSPLASH_ACCESS_KEY not set — using fallback')
    return { imageUrl: FALLBACK_IMAGE, attribution: null, unsplashProfileUrl: null }
  }

  try {
    const query = encodeURIComponent(`${destination} travel landscape`)
    const res = await fetch(
      `https://api.unsplash.com/search/photos?query=${query}&per_page=1&orientation=landscape&content_filter=high`,
      {
        headers: { Authorization: `Client-ID ${accessKey}` },
        next: { revalidate: 0 },
      }
    )

    if (!res.ok) {
      console.error(`[destination-image] Unsplash API error: ${res.status} for "${destination}"`)
      return { imageUrl: FALLBACK_IMAGE, attribution: null, unsplashProfileUrl: null }
    }

    const data = await res.json()
    const photo = data.results?.[0]

    if (!photo) {
      console.warn(`[destination-image] No Unsplash results for "${destination}"`)
      return { imageUrl: FALLBACK_IMAGE, attribution: null, unsplashProfileUrl: null }
    }

    // Use the regular size (1080w) for good quality without being oversized
    const imageUrl: string = photo.urls?.regular ?? photo.urls?.small ?? FALLBACK_IMAGE
    const photographerName: string = photo.user?.name ?? null
    const photographerUsername: string = photo.user?.username ?? null

    // 3. Persist to DB (store photographer name as attribution)
    await db
      .insert(destinationImages)
      .values({ destination, imageUrl, attribution: photographerName })
      .onConflictDoUpdate({
        target: destinationImages.destination,
        set: { imageUrl, attribution: photographerName },
      })

    console.log(`[destination-image] Saved image for "${destination}" by ${photographerName}`)

    const unsplashProfileUrl = photographerUsername
      ? `https://unsplash.com/@${photographerUsername}?utm_source=travel_guide&utm_medium=referral`
      : null

    return { imageUrl, attribution: photographerName, unsplashProfileUrl }
  } catch (err) {
    console.error(`[destination-image] Failed to fetch for "${destination}":`, err)
    return { imageUrl: FALLBACK_IMAGE, attribution: null, unsplashProfileUrl: null }
  }
}

/**
 * Get images for multiple destinations at once.
 * Returns a map of destination → imageUrl.
 * Fetches missing ones in parallel (with concurrency limit).
 */
export async function getDestinationImages(
  destinations: string[]
): Promise<Record<string, string>> {
  const data = await getDestinationImagesWithAttribution(destinations)
  const result: Record<string, string> = {}
  for (const [dest, info] of Object.entries(data)) {
    result[dest] = info.imageUrl
  }
  return result
}

/**
 * Get images and attribution for multiple destinations.
 * Returns a map of destination → { imageUrl, attribution }.
 */
export async function getDestinationImagesWithAttribution(
  destinations: string[]
): Promise<Record<string, { imageUrl: string; attribution: string | null }>> {
  const result: Record<string, { imageUrl: string; attribution: string | null }> = {}

  // First, bulk-fetch all existing from DB
  const existing = await db.select().from(destinationImages)
  const existingMap = new Map(existing.map((r) => [r.destination, { imageUrl: r.imageUrl, attribution: r.attribution }]))

  const missing: string[] = []
  for (const dest of destinations) {
    const data = existingMap.get(dest)
    if (data) {
      result[dest] = data
    } else {
      missing.push(dest)
    }
  }

  // Fetch missing in parallel (max 3 concurrent to stay within rate limits)
  const CONCURRENCY = 3
  for (let i = 0; i < missing.length; i += CONCURRENCY) {
    const batch = missing.slice(i, i + CONCURRENCY)
    const fetched = await Promise.all(
      batch.map(async (dest) => {
        const info = await getDestinationImageWithAttribution(dest)
        return { dest, imageUrl: info.imageUrl, attribution: info.attribution }
      })
    )
    for (const { dest, imageUrl, attribution } of fetched) {
      result[dest] = { imageUrl, attribution }
    }
  }

  return result
}

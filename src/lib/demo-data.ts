/**
 * Static, in-memory data for the login-free /demo experience.
 *
 * Nothing here touches the database, auth, or the LLM. Trips are generated
 * relative to "today" so the 2 upcoming + 2 past split stays correct over time.
 *
 * Advice answers are derived from the live CATEGORY_CONFIG (via getSubQuestions),
 * so when categories/questions change in the app, the demo automatically stays
 * in sync — any question without a hand-written answer gets a sensible generic
 * demo answer.
 */

import type { Trip } from '@/db/schema'
import { CATEGORIES, getSubQuestions } from '@/lib/destinations'
import type { CategorySection } from '@/lib/category-groups'
import { getGroupQuestions } from '@/lib/category-groups'
import { DEMO_ADVICE_GENERATED } from '@/lib/demo-advice.generated'


// ─── Date helpers ─────────────────────────────────────────────────────────────

function isoDate(offsetDays: number): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + offsetDays)
  return d.toISOString().split('T')[0]
}

// ─── Demo trips (2 upcoming + 2 past) ───────────────────────────────────────────

export interface DemoTripSeed {
  id: string
  destination: string
  startOffset: number // days from today
  endOffset: number
  travelMode: string // party type (Solo/Couple/Friends/Family)
  transportMode: string // fly | drive | rail | sail
  startingLocation: string
  budgetUsd: number
  transportCostIncluded: boolean
  travelStyle: string
  activityPreferences: string[]
  heroImage: string
  heroAttribution: string
}

export const DEMO_SEEDS: DemoTripSeed[] = [
  {
    id: 'demo-costa-rica',
    destination: 'Costa Rica',
    startOffset: 21,
    endOffset: 28,
    travelMode: 'Couple',
    transportMode: 'fly',
    startingLocation: 'London, United Kingdom',
    budgetUsd: 3500,
    transportCostIncluded: true,
    travelStyle: 'Adventure, Relaxed',
    activityPreferences: ['Hiking', 'Surfing', 'Wildlife'],
    heroImage:
      'https://images.unsplash.com/photo-1580259679654-9276b39fd2d5?w=1080&q=80&fit=crop',
    heroAttribution: 'Fabian Schneider',
  },
  {
    id: 'demo-japan',
    destination: 'Japan',
    startOffset: 60,
    endOffset: 74,
    travelMode: 'Solo',
    transportMode: 'fly',
    startingLocation: 'New York, United States',
    budgetUsd: 6000,
    transportCostIncluded: false,
    travelStyle: 'Cultural',
    activityPreferences: ['Food exploration', 'Photography', 'Museums'],
    heroImage:
      'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=1080&q=80&fit=crop',
    heroAttribution: 'Jezael Melgoza',
  },
  {
    id: 'demo-italy',
    destination: 'Italy',
    startOffset: -45,
    endOffset: -38,
    travelMode: 'Friends',
    transportMode: 'rail',
    startingLocation: 'Munich, Germany',
    budgetUsd: 2800,
    transportCostIncluded: true,
    travelStyle: 'Cultural, Relaxed',
    activityPreferences: ['Food exploration', 'Walking', 'Museums'],
    heroImage:
      'https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=1080&q=80&fit=crop',
    heroAttribution: 'Christopher Czermak',
  },
  {
    id: 'demo-morocco',
    destination: 'Morocco',
    startOffset: -180,
    endOffset: -170,
    travelMode: 'Couple',
    transportMode: 'fly',
    startingLocation: 'Paris, France',
    budgetUsd: 2200,
    transportCostIncluded: false,
    travelStyle: 'Adventure, Cultural',
    activityPreferences: ['Hiking', 'Food exploration', 'Photography'],
    heroImage:
      'https://images.unsplash.com/photo-1489749798305-4fea3ae63d43?w=1080&q=80&fit=crop',
    heroAttribution: 'Louis Hansel',
  },
]

const FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1498637841888-108c6b723fcb?w=1080&q=80&fit=crop'

/** Build a full Trip-shaped object from a seed. */
function seedToTrip(seed: DemoTripSeed): Trip {
  return {
    id: seed.id,
    userId: 'demo-user',
    destination: seed.destination,
    startDate: isoDate(seed.startOffset),
    endDate: isoDate(seed.endOffset),
    travelMode: seed.travelMode,
    transportMode: seed.transportMode,
    startingLocation: seed.startingLocation,
    budgetUsd: seed.budgetUsd,
    transportCostIncluded: seed.transportCostIncluded,
    travelStyle: seed.travelStyle,
    activityPreferences: seed.activityPreferences,
    createdAt: new Date(),
  }
}

export const DEMO_TRIPS: Trip[] = DEMO_SEEDS.map(seedToTrip)

export function getDemoTrip(tripId: string): Trip | undefined {
  return DEMO_TRIPS.find((t) => t.id === tripId)
}

export function getDemoHero(tripId: string): { imageUrl: string; attribution: string | null } {
  const seed = DEMO_SEEDS.find((s) => s.id === tripId)
  return {
    imageUrl: seed?.heroImage ?? FALLBACK_IMAGE,
    attribution: seed?.heroAttribution ?? null,
  }
}

// ─── Demo advice generation ─────────────────────────────────────────────────────

/**
 * Resolve the answer for a demo trip's (category, question):
 * 1. Prefer the real, pre-generated LLM answer from demo-advice.generated.ts.
 * 2. Fall back to the example patterns in fallbackDemoAnswer() for any
 *    category/question that isn't present (new or reworded questions).
 */
function resolveAnswer(destination: string, category: string, question: string): string {
  const generated = DEMO_ADVICE_GENERATED[destination]?.categories?.[category]?.[question]
  if (generated) return generated
  return fallbackDemoAnswer(destination, category, question)
}

/**
 * Hand-written example answers for a handful of common questions, keyed loosely
 * by substrings so they survive minor wording changes. Used only when no real
 * generated answer exists. Everything else falls back to a generic,
 * destination-aware demo answer.
 */
function fallbackDemoAnswer(destination: string, category: string, question: string): string {
  const q = question.toLowerCase()
  const d = destination

  if (q.includes('driving recommended')) return `Yes — renting a car is a great way to explore ${d} at your own pace, especially outside the main cities.`
  if (q.includes('roads easy to drive')) return `Main roads in ${d} are well maintained; rural routes can be narrower, so allow extra time.`
  if (q.includes('parking easy')) return `Parking is straightforward in most towns in ${d}; use paid car parks in busy centres.`
  if (q.includes('public transport sufficient')) return `${d} has reliable public transport between major hubs — great value for getting around.`
  if (q.includes('car rentals recommended')) return `Recommended if you want flexibility. Book ahead in peak season for the best rates in ${d}.`
  if (q.includes('airport transport') && q.includes('advance')) return `Booking airport transfers in advance is worthwhile to avoid queues on arrival in ${d}.`
  if (q.includes('area should i stay')) return `Stay central for your first visit to ${d} — you'll be within walking distance of the main sights.`
  if (q.includes('hotels') && q.includes('top 3')) return `Well-reviewed mid-range hotels in ${d} balance comfort and value; book 4–6 weeks ahead.`
  if (q.includes('bring cash')) return `Carry some local cash in ${d} for markets and small vendors; cards are widely accepted elsewhere.`
  if (q.includes('atms widely available')) return `ATMs are widely available across ${d}; use bank-affiliated machines to reduce fees.`
  if (q.includes('daily budget')) return `A comfortable daily budget in ${d} covers accommodation, meals, and a couple of activities.`
  if (q.includes('wi-fi') || q.includes('wifi')) return `Wi-Fi is common in hotels and cafés across ${d}; quality is generally good in urban areas.`
  if (q.includes('esim')) return `An eSIM is the easiest way to stay connected in ${d} — set it up before you fly.`
  if (q.includes('clothes should i pack')) return `Pack light, breathable layers for ${d}, plus something warmer for evenings.`
  if (q.includes('insect repellent')) return `Bring insect repellent for ${d}, especially if you'll be near water or in the evenings.`
  if (q.includes('sunscreen')) return `Yes — high-SPF sunscreen is recommended in ${d}. Reapply regularly when outdoors.`
  if (q.includes('vaccinations')) return `Check routine vaccinations before visiting ${d}; consult a travel clinic 4–6 weeks ahead.`
  if (q.includes('restaurants should i try') || q.includes('locals eat')) return `Seek out family-run spots away from the main tourist streets in ${d} for the best local food.`
  if (q.includes('tipping expected')) return `Tipping in ${d} is appreciated but modest — rounding up or ~10% is typical.`
  if (q.includes('street food safe')) return `Street food in ${d} is generally safe at busy stalls with high turnover.`
  if (q.includes('self-service laundrettes')) return `Self-service laundrettes are available in larger towns in ${d} and are inexpensive.`
  if (q.includes('tap water safe')) return `Tap water safety varies in ${d}; when unsure, stick to bottled or filtered water.`
  if (q.includes('activities are worth booking')) return `Book signature experiences in ${d} ahead of time — popular tours sell out in peak season.`
  if (q.includes('tourist traps')) return `Skip the overpriced attractions right by the main squares in ${d}; better value is a short walk away.`
  if (q.includes('hidden gems')) return `Ask locals for their favourite viewpoints and neighbourhoods in ${d} — the best spots rarely make guidebooks.`
  if (q.includes('weather')) return `Expect pleasant, changeable weather in ${d} during your travel window; pack for a range of conditions.`
  if (q.includes('rain showers common')) return `Short showers are possible in ${d}; a compact rain jacket is handy.`
  if (q.includes('safe for solo')) return `${d} is generally safe for solo travellers — take normal precautions, especially at night.`
  if (q.includes('scams to watch')) return `Be aware of common tourist scams in ${d}: overpriced taxis and unofficial "guides".`
  if (q.includes('safe at night')) return `Central areas of ${d} are lively and safe at night; avoid poorly lit backstreets.`
  if (q.includes('greet people')) return `A friendly greeting in the local language goes a long way in ${d}.`
  if (q.includes('taboo')) return `Dress respectfully at religious sites in ${d} and ask before photographing people.`
  if (q.includes('alcoholic drinks on average')) return `Drinks in ${d} are reasonably priced outside tourist hotspots; supermarkets are cheapest.`
  if (q.includes('wish i had known')) return `Slow down — ${d} rewards travellers who linger. Build in unplanned time to wander.`

  // Generic fallback keeps every question answered even as new ones are added.
  return `For ${d}, this is demo advice covering "${question.replace(/\?+$/, '')}". In the full app, this is generated specifically for your trip.`
}

/**
 * Build CategorySection[] for a demo trip using the live category config.
 * Mirrors buildSections() in the real home page but with static answers.
 */
export function buildDemoSections(destination: string): CategorySection[] {
  return CATEGORIES.map((category) => {
    const subQuestions = getSubQuestions(category)
    const answers: Record<string, string> = {}
    for (const question of subQuestions) {
      answers[question] = resolveAnswer(destination, category, question)
    }
    const firstQuestion = subQuestions[0]
    const firstAnswer = firstQuestion ? answers[firstQuestion] : null
    const conciseTip = firstAnswer
      ? (firstAnswer.match(/^[^.!?]*[.!?]/)?.[0].trim() ?? firstAnswer)
      : null

    return {
      category,
      conciseTip,
      answers,
      subQuestions,
    }
  })
}

/**
 * Build the group headline tips map for a demo trip (keyed by group id),
 * derived from the live group definitions so it stays in sync.
 */
/**
 * Resolve a group's headline tip:
 * 1. Prefer the real, pre-generated LLM group tip from demo-advice.generated.ts.
 * 2. Fall back to the example patterns in fallbackGroupTip() for any group id
 *    not present (e.g. a newly added group).
 */
function resolveGroupTip(destination: string, groupId: string, groupName: string): string {
  const generated = DEMO_ADVICE_GENERATED[destination]?.groupTips?.[groupId]
  if (generated) return generated
  return fallbackGroupTip(destination, groupId, groupName)
}

/**
 * Hand-written example group tips, keyed by group id. Used only when no real
 * generated tip exists. Any unknown group id gets a sensible generic line.
 */
function fallbackGroupTip(destination: string, groupId: string, groupName: string): string {
  const d = destination
  switch (groupId) {
    case 'transport': return `Getting around ${d} is easiest with a mix of walking and local transport; a rental car helps for remote spots.`
    case 'accommodation': return `Stay central in ${d} and book a few weeks ahead — the best-value places fill up in peak season.`
    case 'money': return `Cards are widely accepted in ${d}, but carry some cash for markets, taxis and small vendors.`
    case 'food-and-drinks': return `Eat where the locals do in ${d} — family-run spots off the main streets offer the best value and flavour.`
    case 'health': return `${d} is low-risk for healthy travellers; pack sunscreen and any personal medication, and check routine vaccinations.`
    case 'activities': return `Book ${d}'s signature experiences ahead of time and leave room for spontaneous local discoveries.`
    case 'weather': return `Pack for changeable weather in ${d} — layers plus a compact rain jacket cover most conditions.`
    case 'connectivity': return `Staying connected in ${d} is easy — grab an eSIM before you fly and rely on café/hotel Wi-Fi.`
    case 'culture': return `A little local etiquette goes a long way in ${d}: greet warmly, dress respectfully, and ask before photos.`
    case 'packing-and-preparation': return `Pack light for ${d} with versatile layers, comfortable shoes and the essentials for your planned activities.`
    case 'maintenance': return `Self-service laundrettes are available in ${d}'s larger towns and are inexpensive for longer trips.`
    default: return `${groupName} in ${d}: demo highlights tailored to this trip. Tap to read the full advice.`
  }
}

export function buildDemoGroupTips(destination: string): Record<string, string> {
  const tips: Record<string, string> = {}
  for (const g of getGroupQuestions()) {
    tips[g.id] = resolveGroupTip(destination, g.id, g.name)
  }
  return tips
}

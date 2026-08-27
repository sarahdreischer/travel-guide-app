'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { AuthService } from '@/lib/auth'
import { validateTripDates, derivebudgetRange } from '@/lib/validators'
import { DESTINATIONS } from '@/lib/destinations'
import { db } from '@/db'
import { trips } from '@/db/schema'
import { getOrGenerateAdviceAction } from '@/actions/advice'
import { deriveMonthRange } from '@/lib/advice-store'

// ─── Types ────────────────────────────────────────────────────────────────────

export type TripFieldErrors = {
  destination?: string
  startDate?: string
  endDate?: string
  travelMode?: string
  transportMode?: string
  budget?: string
  travelStyle?: string
  activityPreferences?: string
}

export type CreateTripResult =
  | { success: true; tripId: string }
  | { success: false; errors: TripFieldErrors }

// ─── Constants ────────────────────────────────────────────────────────────────

const VALID_TRAVEL_MODES = ['Solo', 'Friends', 'Couple', 'Family'] as const
const VALID_TRANSPORT_MODES = ['fly', 'drive', 'rail', 'sail'] as const
const VALID_TRAVEL_STYLES = [
  'Adventure',
  'Relaxed',
  'Cultural',
  'Luxury',
  'Budget',
  'Family',
] as const

// ─── Server Action ────────────────────────────────────────────────────────────

export async function createTripAction(formData: FormData): Promise<CreateTripResult> {
  // 1. Get current user from session cookie
  const cookieStore = await cookies()
  const token = cookieStore.get('session_token')?.value

  if (!token) {
    redirect('/login')
  }

  const user = await AuthService.getSession(token)

  if (!user) {
    redirect('/login')
  }

  // 2. Extract fields from FormData
  const destination = formData.get('destination') as string | null
  const startDateStr = formData.get('startDate') as string | null
  const endDateStr = formData.get('endDate') as string | null
  const travelMode = formData.get('travelMode') as string | null
  const transportMode = formData.get('transportMode') as string | null
  const startingLocation = formData.get('startingLocation') as string | null
  const budgetStr = formData.get('budget') as string | null
  const transportCostIncludedStr = formData.get('transportCostIncluded') as string | null
  const travelStyle = formData.get('travelStyle') as string | null
  const activityPreferences = formData.getAll('activityPreferences') as string[]

  // 3. Validate all fields
  const errors: TripFieldErrors = {}

  // Destination validation
  if (!destination || !DESTINATIONS.includes(destination as typeof DESTINATIONS[number])) {
    errors.destination = 'Please select a valid destination.'
  }

  // Start date validation
  let startDate: Date | null = null
  if (!startDateStr) {
    errors.startDate = 'Start date is required.'
  } else {
    startDate = new Date(startDateStr)
    if (isNaN(startDate.getTime())) {
      errors.startDate = 'Start date is invalid.'
    }
  }

  // End date validation
  let endDate: Date | null = null
  if (!endDateStr) {
    errors.endDate = 'End date is required.'
  } else {
    endDate = new Date(endDateStr)
    if (isNaN(endDate.getTime())) {
      errors.endDate = 'End date is invalid.'
    }
  }

  // Date range validation (only if both dates are valid)
  if (startDate && endDate) {
    const dateResult = validateTripDates(startDate, endDate)
    if (!dateResult.valid) {
      if (dateResult.error === 'start_date_in_past') {
        errors.startDate = 'Start date cannot be in the past.'
      } else if (dateResult.error === 'end_before_start') {
        errors.endDate = 'End date must be on or after the start date.'
      }
    }
  }

  // Travel mode validation
  if (!travelMode || !VALID_TRAVEL_MODES.includes(travelMode as typeof VALID_TRAVEL_MODES[number])) {
    errors.travelMode = 'Please select a valid travel mode.'
  }

  // Transport mode validation
  if (!transportMode || !VALID_TRANSPORT_MODES.includes(transportMode as typeof VALID_TRANSPORT_MODES[number])) {
    errors.transportMode = 'Please select a primary transport mode.'
  }

  // Budget validation
  let budget: number | null = null
  if (!budgetStr) {
    errors.budget = 'Budget is required.'
  } else {
    budget = Number(budgetStr)
    if (isNaN(budget) || !Number.isFinite(budget) || budget < 1 || budget > 1_000_000) {
      errors.budget = 'Budget must be a number between 1 and 1,000,000 USD.'
    }
  }

  // Travel style validation (comma-separated, at least one must be valid)
  if (!travelStyle) {
    errors.travelStyle = 'Please select a valid travel style.'
  } else {
    const styles = travelStyle.split(',').map((s) => s.trim()).filter(Boolean)
    const allValid = styles.length > 0 && styles.every((s) =>
      VALID_TRAVEL_STYLES.includes(s as typeof VALID_TRAVEL_STYLES[number])
    )
    if (!allValid) {
      errors.travelStyle = 'Please select a valid travel style.'
    }
  }

  // Activity preferences validation
  if (!activityPreferences || activityPreferences.length === 0) {
    errors.activityPreferences = 'Please select at least one activity preference.'
  }

  // 4. If any validation errors, return them
  if (Object.keys(errors).length > 0) {
    return { success: false, errors }
  }

  // 5. All validated — insert trip record
  const [trip] = await db
    .insert(trips)
    .values({
      userId: user.id,
      destination: destination!,
      startDate: startDateStr!,
      endDate: endDateStr!,
      travelMode: travelMode!,
      transportMode: transportMode!,
      startingLocation: startingLocation || null,
      budgetUsd: budget!,
      transportCostIncluded: transportCostIncludedStr === 'true',
      travelStyle: travelStyle!,
      activityPreferences,
    })
    .returning({ id: trips.id })

  // 6. Derive cache key
  const { startMonth, endMonth } = deriveMonthRange(startDateStr!, endDateStr!)
  const cacheKey = {
    destination: destination!.toLowerCase(),
    startMonth,
    endMonth,
    travellerType: travelMode!.toLowerCase(),
    budgetRange: derivebudgetRange(budget!),
    transportMode: transportMode ?? undefined,
    startingLocation: startingLocation || undefined,
    totalBudgetUsd: budget!,
    transportCostIncluded: transportCostIncludedStr === 'true',
    tripDurationDays: Math.max(1, Math.round((new Date(endDateStr!).getTime() - new Date(startDateStr!).getTime()) / 86400000)),
    partySize: travelMode!.toLowerCase(),
    activities: activityPreferences,
  }

  // 7. Trigger advice generation (fire and don't block redirect)
  getOrGenerateAdviceAction(cacheKey).catch(() => {
    // Advice generation failures are logged server-side by the advice action;
    // do not block the user's redirect.
  })

  // 8. Redirect to the "generating advice" page which shows a loading animation
  redirect(`/home/${trip.id}/generating`)
}

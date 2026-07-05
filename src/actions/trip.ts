'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { AuthService } from '@/lib/auth'
import { validateTripDates, derivebudgetRange } from '@/lib/validators'
import { DESTINATIONS } from '@/lib/destinations'
import { db } from '@/db'
import { trips } from '@/db/schema'
import { getOrGenerateAdviceAction } from '@/actions/advice'

// ─── Types ────────────────────────────────────────────────────────────────────

export type TripFieldErrors = {
  destination?: string
  startDate?: string
  endDate?: string
  travelMode?: string
  budget?: string
  travelStyle?: string
  activityPreferences?: string
}

export type CreateTripResult =
  | { success: true; tripId: string }
  | { success: false; errors: TripFieldErrors }

// ─── Constants ────────────────────────────────────────────────────────────────

const VALID_TRAVEL_MODES = ['Solo', 'Friends', 'Couple', 'Family'] as const
const VALID_TRAVEL_STYLES = [
  'Backpacking',
  'Luxury',
  'All inclusive',
  'Digital nomad',
  'Adventure',
  'Beach holiday',
] as const

// ─── Months ───────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
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
  const budgetStr = formData.get('budget') as string | null
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

  // Travel style validation
  if (!travelStyle || !VALID_TRAVEL_STYLES.includes(travelStyle as typeof VALID_TRAVEL_STYLES[number])) {
    errors.travelStyle = 'Please select a valid travel style.'
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
      budgetUsd: budget!,
      travelStyle: travelStyle!,
      activityPreferences,
    })
    .returning({ id: trips.id })

  // 6. Derive cache key
  const month = MONTH_NAMES[startDate!.getMonth()]
  const cacheKey = {
    destination: destination!.toLowerCase(),
    month,
    travellerType: travelMode!.toLowerCase(),
    budgetRange: derivebudgetRange(budget!),
  }

  // 7. Trigger advice generation (fire and don't block redirect)
  getOrGenerateAdviceAction(cacheKey).catch(() => {
    // Advice generation failures are logged server-side by the advice action;
    // do not block the user's redirect.
  })

  // 8. Redirect to trip page (must be outside try/catch)
  redirect(`/home/${trip.id}`)
}

'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { AuthService } from '@/lib/auth'
import { validateTripDates, derivebudgetRange } from '@/lib/validators'
import { DESTINATIONS } from '@/lib/destinations'
import { db } from '@/db'
import { trips } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import type { TripFieldErrors } from '@/actions/trip'

export type UpdateTripResult =
  | { success: true; tripId: string }
  | { success: false; errors: TripFieldErrors }

const VALID_TRAVEL_MODES = ['Solo', 'Friends', 'Couple', 'Family'] as const
const VALID_TRANSPORT_MODES = ['fly', 'drive', 'rail', 'sail'] as const
const VALID_TRAVEL_STYLES = ['Adventure', 'Relaxed', 'Cultural', 'Luxury', 'Budget', 'Family'] as const

export async function updateTripAction(tripId: string, formData: FormData): Promise<UpdateTripResult> {
  const cookieStore = await cookies()
  const token = cookieStore.get('session_token')?.value
  if (!token) redirect('/login')

  const user = await AuthService.getSession(token)
  if (!user) redirect('/login')

  // Extract fields
  const destination = formData.get('destination') as string | null
  const startDateStr = formData.get('startDate') as string | null
  const endDateStr = formData.get('endDate') as string | null
  const travelMode = formData.get('travelMode') as string | null
  const transportMode = formData.get('transportMode') as string | null
  const budgetStr = formData.get('budget') as string | null
  const travelStyle = formData.get('travelStyle') as string | null
  const activityPreferences = formData.getAll('activityPreferences') as string[]

  // Validate
  const errors: TripFieldErrors = {}

  if (!destination || !DESTINATIONS.includes(destination as typeof DESTINATIONS[number])) {
    errors.destination = 'Please select a valid destination.'
  }

  let startDate: Date | null = null
  if (!startDateStr) { errors.startDate = 'Start date is required.' }
  else { startDate = new Date(startDateStr); if (isNaN(startDate.getTime())) errors.startDate = 'Start date is invalid.' }

  let endDate: Date | null = null
  if (!endDateStr) { errors.endDate = 'End date is required.' }
  else { endDate = new Date(endDateStr); if (isNaN(endDate.getTime())) errors.endDate = 'End date is invalid.' }

  if (startDate && endDate) {
    const dateResult = validateTripDates(startDate, endDate)
    if (!dateResult.valid) {
      if (dateResult.error === 'start_date_in_past') errors.startDate = 'Start date cannot be in the past.'
      else if (dateResult.error === 'end_before_start') errors.endDate = 'End date must be on or after the start date.'
    }
  }

  if (!travelMode || !VALID_TRAVEL_MODES.includes(travelMode as typeof VALID_TRAVEL_MODES[number])) {
    errors.travelMode = 'Please select a valid travel mode.'
  }

  if (!transportMode || !VALID_TRANSPORT_MODES.includes(transportMode as typeof VALID_TRANSPORT_MODES[number])) {
    errors.transportMode = 'Please select a primary transport mode.'
  }

  let budget: number | null = null
  if (!budgetStr) { errors.budget = 'Budget is required.' }
  else { budget = Number(budgetStr); if (isNaN(budget) || budget < 1 || budget > 1_000_000) errors.budget = 'Budget must be between 1 and 1,000,000 USD.' }

  if (!travelStyle) {
    errors.travelStyle = 'Please select a valid travel style.'
  } else {
    const styles = travelStyle.split(',').map((s) => s.trim()).filter(Boolean)
    if (!styles.every((s) => VALID_TRAVEL_STYLES.includes(s as typeof VALID_TRAVEL_STYLES[number]))) {
      errors.travelStyle = 'Please select a valid travel style.'
    }
  }

  if (!activityPreferences || activityPreferences.length === 0) {
    errors.activityPreferences = 'Please select at least one activity preference.'
  }

  if (Object.keys(errors).length > 0) return { success: false, errors }

  // Update — only if owned by this user
  await db
    .update(trips)
    .set({
      destination: destination!,
      startDate: startDateStr!,
      endDate: endDateStr!,
      travelMode: travelMode!,
      transportMode: transportMode!,
      budgetUsd: budget!,
      travelStyle: travelStyle!,
      activityPreferences,
    })
    .where(and(eq(trips.id, tripId), eq(trips.userId, user.id)))

  redirect(`/home/${tripId}`)
}

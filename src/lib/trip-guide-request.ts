/**
 * Build the two-stage pipeline request (TripGuideRequest) from a trip row.
 *
 * Single source of truth so the home page, the generating flow, and trip
 * creation all pass identical inputs into getOrGenerateTripGuideAction.
 */

import type { Trip } from '@/db/schema'
import type { TripGuideRequest } from '@/actions/trip-guide'

export function tripToGuideRequest(
  trip: Pick<
    Trip,
    | 'destination'
    | 'startDate'
    | 'endDate'
    | 'travelMode'
    | 'budgetUsd'
    | 'transportMode'
    | 'startingLocation'
    | 'transportCostIncluded'
    | 'activityPreferences'
    | 'travelStyle'
  >
): TripGuideRequest {
  return {
    destination: trip.destination,
    startDate: trip.startDate,
    endDate: trip.endDate,
    travellerType: trip.travelMode,
    budgetUsd: trip.budgetUsd,
    transportMode: trip.transportMode ?? undefined,
    startingLocation: trip.startingLocation ?? undefined,
    transportCostIncluded: trip.transportCostIncluded ?? true,
    activities: trip.activityPreferences,
    travelStyle: trip.travelStyle || undefined,
  }
}

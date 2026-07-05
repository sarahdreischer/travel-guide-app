'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { DESTINATIONS } from '@/lib/destinations'
import { createTripAction, CreateTripResult } from '@/actions/trip'

const TRAVEL_MODES = ['Solo', 'Friends', 'Couple', 'Family'] as const
const TRAVEL_STYLES = [
  'Backpacking',
  'Luxury',
  'All inclusive',
  'Digital nomad',
  'Adventure',
  'Beach holiday',
] as const
const ACTIVITY_OPTIONS = ['Hiking', 'Swimming', 'Surfing', 'Bodyboarding'] as const

function SubmitButton() {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      className="min-h-[44px] min-w-[44px] w-full rounded-md bg-blue-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? 'Creating trip…' : 'Create Trip'}
    </button>
  )
}

export default function TripForm() {
  const [state, formAction] = useActionState<CreateTripResult | null, FormData>(
    async (_prev, formData) => {
      return await createTripAction(formData)
    },
    null
  )

  const errors = state && !state.success ? state.errors : undefined

  return (
    <form action={formAction} className="space-y-5">
      {/* Destination */}
      <div>
        <label htmlFor="destination" className="block text-sm font-medium text-gray-700">
          Destination
        </label>
        <select
          id="destination"
          name="destination"
          required
          className="mt-1 block min-h-[44px] min-w-[44px] w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          aria-describedby={errors?.destination ? 'destination-error' : undefined}
        >
          <option value="">Select a destination</option>
          {DESTINATIONS.map((dest) => (
            <option key={dest} value={dest}>
              {dest}
            </option>
          ))}
        </select>
        {errors?.destination && (
          <p id="destination-error" role="alert" className="mt-1 text-sm text-red-600">
            {errors.destination}
          </p>
        )}
      </div>

      {/* Start Date */}
      <div>
        <label htmlFor="startDate" className="block text-sm font-medium text-gray-700">
          Start date
        </label>
        <input
          id="startDate"
          name="startDate"
          type="date"
          required
          className="mt-1 block min-h-[44px] min-w-[44px] w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          aria-describedby={errors?.startDate ? 'startDate-error' : undefined}
        />
        {errors?.startDate && (
          <p id="startDate-error" role="alert" className="mt-1 text-sm text-red-600">
            {errors.startDate}
          </p>
        )}
      </div>

      {/* End Date */}
      <div>
        <label htmlFor="endDate" className="block text-sm font-medium text-gray-700">
          End date
        </label>
        <input
          id="endDate"
          name="endDate"
          type="date"
          required
          className="mt-1 block min-h-[44px] min-w-[44px] w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          aria-describedby={errors?.endDate ? 'endDate-error' : undefined}
        />
        {errors?.endDate && (
          <p id="endDate-error" role="alert" className="mt-1 text-sm text-red-600">
            {errors.endDate}
          </p>
        )}
      </div>

      {/* Travel Mode */}
      <div>
        <label htmlFor="travelMode" className="block text-sm font-medium text-gray-700">
          Travel mode
        </label>
        <select
          id="travelMode"
          name="travelMode"
          required
          className="mt-1 block min-h-[44px] min-w-[44px] w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          aria-describedby={errors?.travelMode ? 'travelMode-error' : undefined}
        >
          <option value="">Select travel mode</option>
          {TRAVEL_MODES.map((mode) => (
            <option key={mode} value={mode}>
              {mode}
            </option>
          ))}
        </select>
        {errors?.travelMode && (
          <p id="travelMode-error" role="alert" className="mt-1 text-sm text-red-600">
            {errors.travelMode}
          </p>
        )}
      </div>

      {/* Budget */}
      <div>
        <label htmlFor="budget" className="block text-sm font-medium text-gray-700">
          Budget (USD)
        </label>
        <input
          id="budget"
          name="budget"
          type="number"
          min={1}
          max={1000000}
          required
          className="mt-1 block min-h-[44px] min-w-[44px] w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          aria-describedby={errors?.budget ? 'budget-error' : undefined}
        />
        {errors?.budget && (
          <p id="budget-error" role="alert" className="mt-1 text-sm text-red-600">
            {errors.budget}
          </p>
        )}
      </div>

      {/* Travel Style */}
      <div>
        <label htmlFor="travelStyle" className="block text-sm font-medium text-gray-700">
          Travel style
        </label>
        <select
          id="travelStyle"
          name="travelStyle"
          required
          className="mt-1 block min-h-[44px] min-w-[44px] w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          aria-describedby={errors?.travelStyle ? 'travelStyle-error' : undefined}
        >
          <option value="">Select travel style</option>
          {TRAVEL_STYLES.map((style) => (
            <option key={style} value={style}>
              {style}
            </option>
          ))}
        </select>
        {errors?.travelStyle && (
          <p id="travelStyle-error" role="alert" className="mt-1 text-sm text-red-600">
            {errors.travelStyle}
          </p>
        )}
      </div>

      {/* Activity Preferences */}
      <fieldset>
        <legend className="block text-sm font-medium text-gray-700">
          Activity preferences
        </legend>
        <p className="mt-1 text-xs text-gray-600">Select at least one</p>
        <div className="mt-2 space-y-2" aria-describedby={errors?.activityPreferences ? 'activityPreferences-error' : undefined}>
          {ACTIVITY_OPTIONS.map((activity) => (
            <label
              key={activity}
              className="flex items-center gap-3 min-h-[44px] min-w-[44px] cursor-pointer"
            >
              <input
                type="checkbox"
                name="activityPreferences"
                value={activity}
                className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">{activity}</span>
            </label>
          ))}
        </div>
        {errors?.activityPreferences && (
          <p id="activityPreferences-error" role="alert" className="mt-1 text-sm text-red-600">
            {errors.activityPreferences}
          </p>
        )}
      </fieldset>

      <SubmitButton />
    </form>
  )
}

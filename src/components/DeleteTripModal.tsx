'use client'

import { useTransition } from 'react'
import { deleteTripAction } from '@/actions/delete-trip'

interface DeleteTripModalProps {
  tripId: string
  destination: string
  onCancel: () => void
}

/**
 * Confirmation modal for deleting a trip.
 * Shared between the Trips list (swipe-to-delete) and Trip advice page (trash icon).
 */
export default function DeleteTripModal({ tripId, destination, onCancel }: DeleteTripModalProps) {
  const [isPending, startTransition] = useTransition()

  function handleDelete() {
    startTransition(async () => {
      await deleteTripAction(tripId)
    })
  }

  return (
    <div
      className="delete-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-modal-title"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div className="delete-modal-panel">
        <div className="delete-modal-handle" aria-hidden="true" />
        <h2 className="delete-modal-title" id="delete-modal-title">Delete trip</h2>
        <p className="delete-modal-body">
          Are you sure you want to delete your trip to{' '}
          <strong>{destination}</strong>? This will remove all associated travel
          advice and cannot be undone.
        </p>
        <div className="delete-modal-actions">
          <button
            className="delete-modal-cancel"
            onClick={onCancel}
            disabled={isPending}
          >
            Cancel
          </button>
          <button
            className="delete-modal-confirm"
            onClick={handleDelete}
            disabled={isPending}
          >
            {isPending ? 'Deleting…' : 'Delete trip'}
          </button>
        </div>
      </div>
    </div>
  )
}

'use client'

import { useState } from 'react'
import DeleteTripModal from '@/components/DeleteTripModal'

interface DeleteTripButtonProps {
  tripId: string
  destination: string
}

function IconTrash() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  )
}

/**
 * Trash icon button for the Trip advice page header.
 * Opens the shared delete confirmation modal on tap.
 */
export default function DeleteTripButton({ tripId, destination }: DeleteTripButtonProps) {
  const [showModal, setShowModal] = useState(false)

  return (
    <>
      <button
        className="page-header-btn"
        onClick={() => setShowModal(true)}
        aria-label="Delete trip"
      >
        <IconTrash />
      </button>

      {showModal && (
        <DeleteTripModal
          tripId={tripId}
          destination={destination}
          onCancel={() => setShowModal(false)}
        />
      )}
    </>
  )
}

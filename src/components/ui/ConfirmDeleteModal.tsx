'use client'

import { useState } from 'react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { deleteAccountAction } from '@/actions/profile'

interface ConfirmDeleteModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function ConfirmDeleteModal({ isOpen, onClose }: ConfirmDeleteModalProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleConfirmDelete() {
    setIsDeleting(true)
    setError(null)

    try {
      await deleteAccountAction()
      // On success, deleteAccountAction redirects to /login via Next.js redirect()
    } catch (err: unknown) {
      // Next.js redirect() throws a special NEXT_REDIRECT error that must be re-thrown
      if (err instanceof Error && err.message?.includes('NEXT_REDIRECT')) {
        throw err
      }
      setError('Failed to delete account. Please try again later.')
      setIsDeleting(false)
    }
  }

  function handleClose() {
    setError(null)
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Delete Account">
      <p className="text-sm text-gray-600">
        Are you sure you want to permanently delete your account? This action cannot be undone. All
        your trips, votes, and saved data will be permanently removed.
      </p>

      {error && (
        <p className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={handleClose} disabled={isDeleting}>
          Cancel
        </Button>
        <Button
          variant="destructive"
          onClick={handleConfirmDelete}
          isLoading={isDeleting}
        >
          Confirm deletion
        </Button>
      </div>
    </Modal>
  )
}

'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { logoutAction } from '@/actions/auth'
import { updateProfileAction, deleteAccountAction } from '@/actions/profile'
import type { UpdateProfileFieldErrors } from '@/actions/profile'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Modal from '@/components/ui/Modal'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProfileContentProps {
  user: {
    firstName: string
    lastName: string
    profileImagePath: string | null
  }
}

// ─── ProfileContent ───────────────────────────────────────────────────────────

/**
 * Client Component for the user profile page.
 * Displays current user info, editable fields, and account actions.
 *
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6
 */
export default function ProfileContent({ user }: ProfileContentProps) {
  const router = useRouter()

  // ── Form state ──
  const [firstName, setFirstName] = useState(user.firstName)
  const [lastName, setLastName] = useState(user.lastName)
  const [profileImage, setProfileImage] = useState<File | null>(null)
  const [errors, setErrors] = useState<UpdateProfileFieldErrors>({})
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // ── Modal state ──
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // ── Logout state ──
  const [loggingOut, setLoggingOut] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Handle profile update ──────────────────────────────────────────────────

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSaveSuccess(false)
    setErrors({})

    const formData = new FormData()
    formData.append('firstName', firstName)
    formData.append('lastName', lastName)

    if (profileImage) {
      formData.append('profileImage', profileImage)
    }

    const result = await updateProfileAction(formData)

    if (result.success) {
      setSaveSuccess(true)
      router.refresh()
    } else {
      setErrors(result.errors)
    }

    setSaving(false)
  }

  // ── Handle logout ──────────────────────────────────────────────────────────

  async function handleLogout() {
    setLoggingOut(true)
    await logoutAction()
  }

  // ── Handle delete account ──────────────────────────────────────────────────

  async function handleDeleteConfirm() {
    setDeleting(true)
    await deleteAccountAction()
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <main className="mx-auto max-w-md px-4 py-8">
      {/* Profile header */}
      <div className="mb-8 flex flex-col items-center gap-3">
        <div className="relative h-20 w-20 overflow-hidden rounded-full bg-gray-200">
          {user.profileImagePath ? (
            <Image
              src={user.profileImagePath}
              alt={`${user.firstName} ${user.lastName} profile`}
              className="h-full w-full object-cover"
              width={80}
              height={80}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-2xl font-semibold text-gray-500" aria-hidden="true">
              {user.firstName.charAt(0).toUpperCase()}
              {user.lastName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <h1 className="text-xl font-semibold text-gray-900">
          {user.firstName} {user.lastName}
        </h1>
      </div>

      {/* Edit profile form */}
      <form onSubmit={handleSave} className="space-y-5" noValidate>
        <Input
          id="firstName"
          label="First name"
          type="text"
          value={firstName}
          onChange={(e) => {
            setFirstName(e.target.value)
            setErrors((prev) => ({ ...prev, firstName: undefined }))
            setSaveSuccess(false)
          }}
          error={errors.firstName}
          aria-required="true"
        />

        <Input
          id="lastName"
          label="Last name"
          type="text"
          value={lastName}
          onChange={(e) => {
            setLastName(e.target.value)
            setErrors((prev) => ({ ...prev, lastName: undefined }))
            setSaveSuccess(false)
          }}
          error={errors.lastName}
          aria-required="true"
        />

        {/* Profile image upload */}
        <div>
          <label
            htmlFor="profileImage"
            className="block text-sm font-medium text-gray-700"
          >
            Profile image
          </label>
          <input
            ref={fileInputRef}
            id="profileImage"
            name="profileImage"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => {
              setProfileImage(e.target.files?.[0] ?? null)
              setErrors((prev) => ({ ...prev, profileImage: undefined }))
              setSaveSuccess(false)
            }}
            aria-invalid={!!errors.profileImage}
            aria-describedby={errors.profileImage ? 'profileImage-error' : undefined}
            className="mt-1 block w-full min-h-[44px] min-w-[44px] text-sm text-gray-600 file:mr-4 file:rounded-md file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100"
          />
          {errors.profileImage && (
            <p id="profileImage-error" className="mt-1 text-sm text-red-600" role="alert">
              {errors.profileImage}
            </p>
          )}
          <p className="mt-1 text-xs text-gray-600">JPEG, PNG, or WebP. Max 5 MB.</p>
        </div>

        {/* Save button */}
        <Button type="submit" isLoading={saving} className="w-full">
          Save changes
        </Button>

        {saveSuccess && (
          <p className="text-center text-sm text-green-600" role="status">
            Profile updated successfully.
          </p>
        )}
      </form>

      {/* Divider */}
      <hr className="my-8 border-gray-200" />

      {/* Terms & Conditions link */}
      <div className="mb-6">
        <a
          href="/terms"
          className="inline-flex min-h-[44px] min-w-[44px] items-center text-sm font-medium text-blue-600 underline hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
        >
          Terms &amp; Conditions
        </a>
      </div>

      {/* Account actions */}
      <div className="space-y-3">
        <Button
          variant="secondary"
          onClick={handleLogout}
          isLoading={loggingOut}
          className="w-full"
        >
          Log out
        </Button>

        <Button
          variant="destructive"
          onClick={() => setDeleteModalOpen(true)}
          className="w-full"
        >
          Delete account
        </Button>
      </div>

      {/* Delete confirmation modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Delete account"
      >
        <p className="text-sm text-gray-700 mb-6">
          Are you sure you want to permanently delete your account? This action cannot be undone and all your data will be lost.
        </p>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button
            variant="secondary"
            onClick={() => setDeleteModalOpen(false)}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDeleteConfirm}
            isLoading={deleting}
          >
            Delete permanently
          </Button>
        </div>
      </Modal>
    </main>
  )
}

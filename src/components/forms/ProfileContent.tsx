'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { logoutAction } from '@/actions/auth'
import { updateProfileAction, deleteAccountAction } from '@/actions/profile'
import type { UpdateProfileFieldErrors } from '@/actions/profile'
import AppFooter from '@/components/AppFooter'

interface ProfileContentProps {
  user: {
    firstName: string
    lastName: string
    profileImagePath: string | null
  }
}

function IconChevronRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 18l6-6-6-6" />
    </svg>
  )
}

export default function ProfileContent({ user }: ProfileContentProps) {
  const router = useRouter()
  const [firstName, setFirstName] = useState(user.firstName)
  const [lastName, setLastName] = useState(user.lastName)
  const [profileImage, setProfileImage] = useState<File | null>(null)
  const [errors, setErrors] = useState<UpdateProfileFieldErrors>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const initials = [firstName[0], lastName[0]].filter(Boolean).join('').toUpperCase()
  const displayName = [firstName, lastName].filter(Boolean).join(' ')

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    setErrors({})

    const formData = new FormData()
    formData.append('firstName', firstName)
    formData.append('lastName', lastName)
    if (profileImage) formData.append('profileImage', profileImage)

    const result = await updateProfileAction(formData)
    if (result.success) {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      router.refresh()
    } else {
      setErrors(result.errors)
    }
    setSaving(false)
  }

  async function handleLogout() {
    setLoggingOut(true)
    await logoutAction()
  }

  async function handleDeleteConfirm() {
    setDeleting(true)
    await deleteAccountAction()
  }

  return (
    <>
      <header className="page-header">
        <h1 className="page-title">Profile</h1>
        <div className="page-brand">
          <Image src="/app-icon.png" alt="" width={22} height={22} className="page-brand-icon" aria-hidden="true" />
          <span className="page-brand-label">Travel Guide</span>
        </div>
        <div style={{ width: 36 }} />
      </header>

      <div className="page-body">
        {/* Identity block */}
        <div className="profile-identity">
          <button
            className="profile-avatar"
            onClick={() => fileRef.current?.click()}
            aria-label="Change profile photo"
          >
            <span className="profile-initials">{initials || '?'}</span>
          </button>
          <div className="profile-name-block">
            <p className="profile-display-name">{displayName || 'Your name'}</p>
            <button
              className="profile-change-photo"
              onClick={() => fileRef.current?.click()}
            >
              Change photo
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            style={{ display: 'none' }}
            onChange={(e) => {
              setProfileImage(e.target.files?.[0] ?? null)
              setSaved(false)
            }}
            aria-label="Upload profile photo"
          />
        </div>

        {/* Account details */}
        <span className="section-label" style={{ marginTop: 8, display: 'block' }}>
          Account details
        </span>
        <div className="profile-form">
          <div className="field-block">
            <label className="field-label" htmlFor="profile-first">First name</label>
            <input
              id="profile-first"
              type="text"
              className="field-input"
              value={firstName}
              onChange={(e) => { setFirstName(e.target.value); setSaved(false) }}
              autoComplete="given-name"
            />
            {errors.firstName && <p className="field-error">{errors.firstName}</p>}
          </div>
          <div className="field-block">
            <label className="field-label" htmlFor="profile-last">Last name</label>
            <input
              id="profile-last"
              type="text"
              className="field-input"
              value={lastName}
              onChange={(e) => { setLastName(e.target.value); setSaved(false) }}
              autoComplete="family-name"
            />
            {errors.lastName && <p className="field-error">{errors.lastName}</p>}
          </div>
          {errors.profileImage && <p className="field-error">{errors.profileImage}</p>}
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : saved ? 'Saved' : 'Save changes'}
          </button>
        </div>

        {/* Account actions */}
        <span className="section-label" style={{ marginTop: 24, display: 'block' }}>
          Account
        </span>
        <div style={{ borderTop: '1px solid var(--border)' }}>
          <a href="/terms" className="profile-action-row">
            <span>Terms &amp; Conditions</span>
            <IconChevronRight />
          </a>
          <button className="profile-action-row" onClick={handleLogout} disabled={loggingOut}>
            <span>{loggingOut ? 'Logging out…' : 'Log out'}</span>
            <IconChevronRight />
          </button>
        </div>

        {/* Delete account */}
        <div className="profile-delete-row">
          <button className="profile-delete-btn" onClick={() => setShowDeleteModal(true)}>
            Delete account
          </button>
        </div>
        <AppFooter />
      </div>

      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <div
          className="delete-modal-overlay"
          role="dialog"
          aria-modal="true"
          onClick={(e) => { if (e.target === e.currentTarget) setShowDeleteModal(false) }}
        >
          <div className="delete-modal-panel">
            <div className="delete-modal-handle" aria-hidden="true" />
            <h2 className="delete-modal-title">Delete account</h2>
            <p className="delete-modal-body">
              Are you sure you want to permanently delete your account? This action
              cannot be undone and all your trips and data will be lost.
            </p>
            <div className="delete-modal-actions">
              <button className="delete-modal-cancel" onClick={() => setShowDeleteModal(false)} disabled={deleting}>
                Cancel
              </button>
              <button className="delete-modal-confirm" onClick={handleDeleteConfirm} disabled={deleting}>
                {deleting ? 'Deleting…' : 'Delete permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

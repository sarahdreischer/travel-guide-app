'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'
import { setupProfileAction } from '@/actions/profile'
import type { ProfileFieldErrors } from '@/actions/profile'
import { validateEmail } from '@/lib/validators'
import AppFooter from '@/components/AppFooter'

function IconEye() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function IconEyeOff() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}

export default function SetupForm() {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [errors, setErrors] = useState<ProfileFieldErrors & { password?: string }>({})
  const [showDisclaimer, setShowDisclaimer] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const firstRef = useRef<HTMLInputElement>(null)

  const canSubmit = firstName.trim() && lastName.trim() && email.includes('@') && password.length >= 6

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const newErrors: typeof errors = {}
    if (!firstName.trim()) newErrors.firstName = 'First name is required.'
    if (!lastName.trim()) newErrors.lastName = 'Last name is required.'
    if (!email.trim()) newErrors.email = 'Email is required.'
    else if (!validateEmail(email.trim())) newErrors.email = 'Please enter a valid email address.'
    if (!password) newErrors.password = 'Password is required.'
    else if (password.length < 6) newErrors.password = 'At least 6 characters.'
    setErrors(newErrors)
    if (Object.keys(newErrors).length === 0) setShowDisclaimer(true)
  }

  // Clear a single field's validation error as the user corrects it.
  function clearError(field: keyof typeof errors) {
    setErrors((prev) => {
      if (!prev[field]) return prev
      const next = { ...prev }
      delete next[field]
      return next
    })
  }

  async function handleAcknowledge() {
    setSubmitting(true)
    const fd = new FormData()
    fd.append('firstName', firstName.trim())
    fd.append('lastName', lastName.trim())
    fd.append('email', email.trim())
    fd.append('password', password)

    const result = await setupProfileAction(fd)
    if (!result.success) {
      setErrors(result.errors)
      setShowDisclaimer(false)
      setSubmitting(false)
      firstRef.current?.focus()
    }
  }

  return (
    <>
      <div className="auth-page">
      <div className="auth-shell">
        <p className="auth-wordmark">
          <Image src="/app-icon.png" alt="" width={22} height={22} className="auth-wordmark-icon" aria-hidden="true" />
          Travel Guide
        </p>

        <div className="auth-heading-block">
          <h1 className="auth-heading">Create an account</h1>
          <p className="auth-subtitle">Set up your account to get personalised travel advice.</p>
        </div>

        <form onSubmit={handleSubmit} className="form-stack" noValidate>
          <div className="field-block">
            <label className="field-label" htmlFor="signup-first">First name</label>
            <input
              ref={firstRef} id="signup-first" type="text" className="field-input"
              placeholder="First name" autoComplete="given-name"
              value={firstName} onChange={(e) => { setFirstName(e.target.value); clearError('firstName') }}
            />
            {errors.firstName && <p className="field-error">{errors.firstName}</p>}
          </div>

          <div className="field-block">
            <label className="field-label" htmlFor="signup-last">Last name</label>
            <input
              id="signup-last" type="text" className="field-input"
              placeholder="Last name" autoComplete="family-name"
              value={lastName} onChange={(e) => { setLastName(e.target.value); clearError('lastName') }}
            />
            {errors.lastName && <p className="field-error">{errors.lastName}</p>}
          </div>

          <div className="field-block">
            <label className="field-label" htmlFor="signup-email">Email</label>
            <input
              id="signup-email" type="email" className="field-input"
              placeholder="you@example.com" autoComplete="email"
              value={email} onChange={(e) => { setEmail(e.target.value); clearError('email') }}
            />
            {errors.email && <p className="field-error">{errors.email}</p>}
          </div>

          <div className="field-block">
            <label className="field-label" htmlFor="signup-password">Password</label>
            <div className="pw-wrapper">
              <input
                id="signup-password" type={showPw ? 'text' : 'password'}
                className="field-input" placeholder="••••••••" autoComplete="new-password"
                value={password} onChange={(e) => { setPassword(e.target.value); clearError('password') }}
              />
              <button type="button" className="pw-toggle" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? 'Hide password' : 'Show password'}>
                {showPw ? <IconEyeOff /> : <IconEye />}
              </button>
            </div>
            <p className="field-hint">At least 6 characters.</p>
            {errors.password && <p className="field-error">{errors.password}</p>}
          </div>

          <button type="submit" className="btn-primary" disabled={!canSubmit || submitting}>
            {submitting ? 'Creating…' : 'Create account'}
          </button>
        </form>

        <div className="auth-toggle">
          <span>Already have an account?</span>
          <a href="/login" className="auth-toggle-link">Log in</a>
        </div>
      </div>
      <AppFooter />
      </div>

      {/* Liability disclaimer bottom sheet */}
      {showDisclaimer && (
        <div
          className="delete-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="disclaimer-title"
          onClick={(e) => { if (e.target === e.currentTarget) setShowDisclaimer(false) }}
        >
          <div className="delete-modal-panel">
            <div className="delete-modal-handle" aria-hidden="true" />
            <h2 className="delete-modal-title" id="disclaimer-title">Liability disclaimer</h2>
            <p className="delete-modal-body">
              The travel advice provided by Travel Guide is generated by AI and is intended for
              informational purposes only. We do not guarantee the accuracy, completeness, or
              timeliness of any advice. Travel conditions change frequently. Always verify
              critical information with official sources before making travel decisions. By
              proceeding, you acknowledge that Travel Guide and its creators are not liable for
              any loss, injury, or inconvenience arising from the use of this information.
            </p>
            <div className="delete-modal-actions">
              <button className="delete-modal-cancel" onClick={() => setShowDisclaimer(false)} disabled={submitting}>
                Cancel
              </button>
              <button className="delete-modal-confirm" onClick={handleAcknowledge} disabled={submitting}
                style={{ background: 'var(--ink)' }}>
                {submitting ? 'Creating…' : 'I acknowledge'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { resetPasswordAction, validateResetTokenAction } from '@/actions/reset-password'
import AppFooter from '@/components/AppFooter'

// ─── Icons ────────────────────────────────────────────────────────────────────

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

// ─── Strength Bar ─────────────────────────────────────────────────────────────

function StrengthBar({ password }: { password: string }) {
  const score = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length

  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong']
  const colors = ['', '#E53E3E', '#DD6B20', '#38A169', '#1A5568']

  return (
    <div className="pw-strength">
      <div className="pw-strength-bars">
        {[1, 2, 3, 4].map((n) => (
          <div
            key={n}
            className="pw-strength-bar"
            style={{ background: n <= score ? colors[score] : 'var(--border-mid)' }}
          />
        ))}
      </div>
      {password.length > 0 && (
        <span className="pw-strength-label" style={{ color: colors[score] }}>
          {labels[score]}
        </span>
      )}
    </div>
  )
}

// ─── Password Field ───────────────────────────────────────────────────────────

function PasswordField({
  id, value, onChange, autoComplete,
}: {
  id: string
  value: string
  onChange: (v: string) => void
  autoComplete?: string
}) {
  const [show, setShow] = useState(false)
  return (
    <div className="pw-wrapper">
      <input
        id={id}
        type={show ? 'text' : 'password'}
        className="field-input"
        placeholder="••••••••"
        autoComplete={autoComplete ?? 'new-password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <button
        type="button"
        className="pw-toggle"
        onClick={() => setShow((v) => !v)}
        aria-label={show ? 'Hide password' : 'Show password'}
      >
        {show ? <IconEyeOff /> : <IconEye />}
      </button>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ResetPasswordForm() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token') || ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tokenValid, setTokenValid] = useState<boolean | null>(null)

  // Validate token on mount
  useEffect(() => {
    if (!token) {
      setTokenValid(false)
      return
    }
    validateResetTokenAction(token).then((result) => {
      setTokenValid(result.valid)
    })
  }, [token])

  const requirements = [
    { label: 'At least 8 characters', met: password.length >= 8 },
    { label: 'One uppercase letter', met: /[A-Z]/.test(password) },
    { label: 'One number', met: /[0-9]/.test(password) },
    { label: 'One special character', met: /[^A-Za-z0-9]/.test(password) },
  ]
  const allMet = requirements.every((r) => r.met)
  const matches = password === confirm && confirm.length > 0
  const canSubmit = allMet && matches

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)

    const result = await resetPasswordAction(token, password)
    if (result.success) {
      setDone(true)
    } else {
      setError(result.error)
    }
    setSubmitting(false)
  }

  // Loading state while validating token
  if (tokenValid === null) {
    return (
      <div className="auth-page">
        <div className="auth-shell">
          <p className="auth-wordmark">
            <Image src="/app-icon.png" alt="" width={22} height={22} className="auth-wordmark-icon" aria-hidden="true" />
            Travel Guide
          </p>
          <p className="auth-subtitle">Validating your reset link…</p>
        </div>
      </div>
    )
  }

  // Invalid/expired token
  if (tokenValid === false) {
    return (
      <div className="auth-page">
        <div className="auth-shell">
          <p className="auth-wordmark">
            <Image src="/app-icon.png" alt="" width={22} height={22} className="auth-wordmark-icon" aria-hidden="true" />
            Travel Guide
          </p>
          <div className="auth-heading-block">
            <h1 className="auth-heading">Link expired</h1>
            <p className="auth-subtitle">
              This password reset link is invalid or has expired. Please request a new one.
            </p>
          </div>
          <a href="/forgot-password" className="btn-primary" style={{ textDecoration: 'none', textAlign: 'center' }}>
            Request new link
          </a>
        </div>
        <AppFooter />
      </div>
    )
  }

  return (
    <div className="auth-page">
      <div className="auth-shell">
        <p className="auth-wordmark">
          <Image src="/app-icon.png" alt="" width={22} height={22} className="auth-wordmark-icon" aria-hidden="true" />
          Travel Guide
        </p>

        {!done ? (
          <>
            <div className="auth-heading-block">
              <h1 className="auth-heading">Choose a new password</h1>
              <p className="auth-subtitle">
                Your reset link is valid. Pick something you haven&apos;t used before.
              </p>
            </div>

            <div className="reset-token-badge">
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }} aria-hidden="true">
                <rect x="2" y="7" width="12" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
                <path d="M5 7V5a3 3 0 1 1 6 0v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              Secure link &middot; expires in 24 h
            </div>

            <form onSubmit={handleSubmit} className="form-stack" noValidate>
              <div className="field-block">
                <label className="field-label" htmlFor="reset-pw">New password</label>
                <PasswordField
                  id="reset-pw"
                  value={password}
                  onChange={setPassword}
                  autoComplete="new-password"
                />
                <StrengthBar password={password} />
                <ul className="pw-requirements">
                  {requirements.map((r) => (
                    <li key={r.label} className={`pw-req${r.met ? ' pw-req-met' : ''}`}>
                      <span className="pw-req-dot" aria-hidden="true" />
                      {r.label}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="field-block">
                <label className="field-label" htmlFor="reset-confirm">Confirm password</label>
                <PasswordField
                  id="reset-confirm"
                  value={confirm}
                  onChange={setConfirm}
                  autoComplete="new-password"
                />
                {confirm.length > 0 && (
                  <p className={`pw-match-msg${matches ? ' pw-match-ok' : ' pw-match-err'}`}>
                    {matches ? 'Passwords match' : "Passwords don\u0027t match"}
                  </p>
                )}
              </div>

              {error && (
                <div role="alert" className="auth-error">
                  <p>{error}</p>
                </div>
              )}

              <button type="submit" className="btn-primary" disabled={!canSubmit || submitting}>
                {submitting ? 'Updating…' : 'Set new password'}
              </button>
            </form>
          </>
        ) : (
          <>
            <div className="reset-done-icon" aria-hidden="true">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <circle cx="14" cy="14" r="12" stroke="currentColor" strokeWidth="1.6" />
                <path d="M8.5 14l4 4 7-8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="auth-heading-block">
              <h1 className="auth-heading">Password updated</h1>
              <p className="auth-subtitle">
                Your password has been changed successfully. You can now log in with your new credentials.
              </p>
            </div>
            <a href="/login" className="btn-primary" style={{ textDecoration: 'none', textAlign: 'center' }}>
              Back to login
            </a>
          </>
        )}
      </div>
      <AppFooter />
    </div>
  )
}

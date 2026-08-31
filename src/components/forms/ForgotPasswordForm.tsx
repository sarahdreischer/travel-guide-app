'use client'

import { useState, useActionState, useCallback } from 'react'
import Image from 'next/image'
import { forgotPasswordAction, resendResetEmailAction, ForgotPasswordResult } from '@/actions/forgot-password'
import AppFooter from '@/components/AppFooter'

function IconArrowLeft() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 12H5M12 5l-7 7 7 7" />
    </svg>
  )
}

function IconEnvelope() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <path d="M2 7a2 2 0 0 1 2-2h20a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7Z" stroke="currentColor" strokeWidth="1.6" />
      <path d="M2 7l12 9 12-9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

export default function ForgotPasswordForm() {
  const [state, formAction] = useActionState<ForgotPasswordResult | null, FormData>(forgotPasswordAction, null)
  const [email, setEmail] = useState('')
  const [resent, setResent] = useState(false)

  const sent = state?.success === true
  const hasError = state && !state.success

  const handleResend = useCallback(async () => {
    if (!email) return
    setResent(true)
    await resendResetEmailAction(email)
    setTimeout(() => setResent(false), 3000)
  }, [email])

  return (
    <div className="auth-page">
      <div className="auth-shell">
        <p className="auth-wordmark">
          <Image src="/app-icon.png" alt="" width={22} height={22} className="auth-wordmark-icon" aria-hidden="true" />
          Trip Guide
        </p>

        {!sent ? (
          <>
            <a href="/login" className="auth-back-btn">
              <IconArrowLeft /> Back to login
            </a>

            <div className="auth-heading-block">
              <h1 className="auth-heading">Reset your password</h1>
              <p className="auth-subtitle">
                Enter the email address linked to your account and we&apos;ll send you a reset link.
              </p>
            </div>

            <form action={(fd) => { setEmail((fd.get('email') as string) || ''); formAction(fd) }} className="form-stack" noValidate>
              <div className="field-block">
                <label className="field-label" htmlFor="forgot-email">Email address</label>
                <input
                  id="forgot-email"
                  name="email"
                  type="email"
                  className="field-input"
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              {hasError && 'error' in state && (
                <div role="alert" className="auth-error">
                  <p>{state.error}</p>
                </div>
              )}

              <button type="submit" className="btn-primary" disabled={!email.includes('@')}>
                Send reset link
              </button>
            </form>
          </>
        ) : (
          <>
            <div className="reset-sent-icon" aria-hidden="true">
              <IconEnvelope />
            </div>

            <div className="auth-heading-block">
              <h1 className="auth-heading">Check your inbox</h1>
              <p className="auth-subtitle">
                We&apos;ve sent a password reset link to <strong>{email}</strong>. The link is valid for 24 hours.
              </p>
            </div>

            <div className="reset-sent-steps">
              {[
                'Open the email from Trip Guide',
                'Click the secure reset link',
                'Choose a new password',
              ].map((step, i) => (
                <div key={i} className="reset-step">
                  <span className="reset-step-num">{i + 1}</span>
                  <span className="reset-step-text">{step}</span>
                </div>
              ))}
            </div>

            <div className="reset-sent-actions">
              <div className="auth-toggle" style={{ justifyContent: 'center' }}>
                <span>Didn&apos;t get it?</span>
                <button type="button" className="auth-toggle-link" onClick={handleResend}>
                  {resent ? 'Sent!' : 'Resend email'}
                </button>
              </div>
              <a href="/login" className="auth-back-btn auth-back-btn-center">
                Back to login
              </a>
            </div>
          </>
        )}
      </div>
      <AppFooter />
    </div>
  )
}

'use client'

import { useActionState, useState, useCallback } from 'react'
import { useFormStatus } from 'react-dom'
import Image from 'next/image'
import { loginAction, LoginActionResult } from '@/actions/auth'
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

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" className="btn-primary" disabled={pending} aria-disabled={pending}>
      {pending ? 'Logging in…' : 'Log in'}
    </button>
  )
}

export default function LoginForm() {
  const [state, formAction] = useActionState<LoginActionResult | null, FormData>(loginAction, null)
  const [dismissed, setDismissed] = useState(false)
  const [showPw, setShowPw] = useState(false)

  const handleInputChange = useCallback(() => { if (!dismissed) setDismissed(true) }, [dismissed])

  const hasError = state?.error != null && !dismissed
  const isLocked = state?.error?.type === 'account_locked'

  return (
    <div className="auth-page">
    <div className="auth-shell">
      <p className="auth-wordmark">
        <Image src="/app-icon.png" alt="" width={22} height={22} className="auth-wordmark-icon" aria-hidden="true" />
        Travel Guide
      </p>

      <div className="auth-heading-block">
        <h1 className="auth-heading">Welcome back</h1>
        <p className="auth-subtitle">Log in to access your trips and travel advice.</p>
      </div>

      <form
        action={(fd) => { setDismissed(false); formAction(fd) }}
        className="form-stack"
        noValidate
        aria-describedby={hasError ? 'login-error' : undefined}
      >
        <div className="field-block">
          <label className="field-label" htmlFor="email">Email</label>
          <input
            id="email" name="email" type="email" required autoComplete="email"
            className="field-input" placeholder="you@example.com"
            onChange={handleInputChange}
          />
        </div>

        <div className="field-block">
          <div className="auth-field-label-row">
            <label className="field-label" htmlFor="password">Password</label>
            <a href="/forgot-password" className="auth-forgot-link">Forgot password?</a>
          </div>
          <div className="pw-wrapper">
            <input
              id="password" name="password" type={showPw ? 'text' : 'password'}
              required autoComplete="current-password"
              className="field-input" placeholder="••••••••"
              onChange={handleInputChange}
            />
            <button type="button" className="pw-toggle" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? 'Hide password' : 'Show password'}>
              {showPw ? <IconEyeOff /> : <IconEye />}
            </button>
          </div>
        </div>

        <SubmitButton />

        {hasError && (
          <div id="login-error" role="alert" aria-live="assertive" className="auth-error">
            {isLocked ? (
              <p>🔒 Account temporarily locked. Try again in {state.error!.remainingMinutes} min.</p>
            ) : (
              <p>{state.error!.message}</p>
            )}
          </div>
        )}
      </form>

      <div className="auth-toggle">
        <span>New here?</span>
        <a href="/setup" className="auth-toggle-link">Create an account</a>
      </div>
    </div>
    <AppFooter />
    </div>
  )
}

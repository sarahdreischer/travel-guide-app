'use client'

import { useActionState, useState, useCallback } from 'react'
import { useFormStatus } from 'react-dom'
import { loginAction, LoginActionResult } from '@/actions/auth'

function SubmitButton() {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-[44px] min-w-[44px] w-full rounded-md bg-blue-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
      aria-disabled={pending}
    >
      {pending ? 'Logging in…' : 'Log in'}
    </button>
  )
}

export default function LoginForm() {
  const [state, formAction] = useActionState<LoginActionResult | null, FormData>(
    loginAction,
    null
  )
  const [dismissed, setDismissed] = useState(false)

  const handleInputChange = useCallback(() => {
    if (!dismissed) {
      setDismissed(true)
    }
  }, [dismissed])

  // Reset dismissed flag when a new server response arrives
  const hasError = state?.error != null && !dismissed
  const isLocked = state?.error?.type === 'account_locked'
  const errorId = 'login-error'

  return (
    <form
      action={(formData) => {
        setDismissed(false)
        formAction(formData)
      }}
      className="space-y-4"
      aria-describedby={hasError ? errorId : undefined}
    >
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          onChange={handleInputChange}
          className="mt-1 block min-h-[44px] min-w-[44px] w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-gray-700">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          onChange={handleInputChange}
          className="mt-1 block min-h-[44px] min-w-[44px] w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <SubmitButton />

      {hasError && (
        <div
          id={errorId}
          role="alert"
          aria-live="assertive"
          className={`mt-3 rounded-md p-3 text-sm ${
            isLocked
              ? 'border border-amber-300 bg-amber-50 text-amber-800'
              : 'border border-red-300 bg-red-50 text-red-700'
          }`}
        >
          {isLocked ? (
            <p>
              <span className="mr-1.5" aria-hidden="true">🔒</span>
              Your account is temporarily locked. Please try again in{' '}
              {state.error!.remainingMinutes}{' '}
              {state.error!.remainingMinutes === 1 ? 'minute' : 'minutes'}.
            </p>
          ) : (
            <p>{state.error!.message}</p>
          )}
        </div>
      )}
    </form>
  )
}

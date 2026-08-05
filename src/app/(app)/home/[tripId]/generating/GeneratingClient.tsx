'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const LOADING_MESSAGES = [
  'Researching local transportation options…',
  'Checking accommodation availability…',
  'Analysing budget and money tips…',
  'Reviewing connectivity options…',
  'Compiling packing recommendations…',
  'Finding the best local food spots…',
  'Evaluating safety information…',
  'Gathering weather forecasts…',
  'Discovering hidden gems and activities…',
  'Reviewing local safety tips…',
  'Checking laundry options nearby…',
  'Almost there…',
]

/**
 * Maximum seconds to wait on this page before redirecting to the trip home.
 * Configurable via data attribute from server, defaults to 15 seconds.
 */
const DEFAULT_TIMEOUT_SECONDS = 15

interface GeneratingClientProps {
  tripId: string
  destination: string
  timeoutSeconds?: number
}

export default function GeneratingClient({
  tripId,
  destination,
  timeoutSeconds = DEFAULT_TIMEOUT_SECONDS,
}: GeneratingClientProps) {
  const router = useRouter()
  const [messageIndex, setMessageIndex] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [failed, setFailed] = useState(false)
  const [complete, setComplete] = useState(false)
  const redirected = useRef(false)

  const progress = Math.min(Math.round((elapsed / timeoutSeconds) * 100), 99)

  // Cycle through loading messages faster
  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((i) => (i + 1) % LOADING_MESSAGES.length)
    }, 2000)
    return () => clearInterval(interval)
  }, [])

  // Elapsed timer + hard timeout redirect
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed((e) => {
        const next = e + 1
        if (next >= timeoutSeconds && !redirected.current) {
          redirected.current = true
          router.replace(`/home/${tripId}`)
        }
        return next
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [timeoutSeconds, tripId, router])

  // Poll for completion — redirect immediately if done early
  useEffect(() => {
    let cancelled = false

    const poll = async () => {
      if (cancelled || redirected.current) return

      try {
        const res = await fetch(`/api/advice-status/${tripId}`)
        if (!res.ok) throw new Error('status check failed')
        const data = await res.json()

        if (data.complete) {
          setComplete(true)
          if (!redirected.current) {
            redirected.current = true
            router.replace(`/home/${tripId}`)
          }
          return
        }
      } catch {
        // Don't fail — timeout will handle the redirect
      }

      if (!cancelled && !redirected.current) {
        setTimeout(poll, 3000)
      }
    }

    // Start polling after 3 seconds (give AI time to start)
    const timer = setTimeout(poll, 3000)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [tripId, router])

  if (failed) {
    return (
      <main className="flex min-h-[60vh] flex-col items-center justify-center p-4 text-center">
        <div className="max-w-md">
          <div className="mb-4 text-4xl">⚠️</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">
            Couldn&apos;t generate travel advice
          </h1>
          <p className="text-sm text-gray-600 mb-6">
            Your trip to <span className="font-medium">{destination}</span> was saved successfully,
            but we couldn&apos;t fetch the AI-generated advice right now. Please check back later —
            advice will be generated on your next visit.
          </p>
          <Link
            href={`/home/${tripId}`}
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg bg-blue-600 px-6 py-2 text-white font-medium hover:bg-blue-700 transition-colors"
          >
            Go to trip anyway
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center p-4 text-center">
      <div className="max-w-md">
        {/* Animated spinner */}
        <div className="mb-6 flex justify-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
        </div>

        <h1 className="text-xl font-bold text-gray-900 mb-2">
          Preparing your {destination} trip
        </h1>

        <p className="text-sm text-gray-600 mb-4 h-5 transition-opacity duration-500">
          {complete ? 'Ready! Redirecting…' : LOADING_MESSAGES[messageIndex]}
        </p>

        {/* Progress bar — based on elapsed time, smooth animation */}
        <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-1000 ease-linear"
            style={{ width: `${complete ? 100 : Math.max(progress, 5)}%` }}
          />
        </div>
        <p className="text-xs text-gray-500">
          {complete ? '100% complete' : `${progress}% complete`}
        </p>
      </div>
    </main>
  )
}

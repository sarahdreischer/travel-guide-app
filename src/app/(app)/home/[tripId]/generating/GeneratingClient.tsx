'use client'

import { useEffect, useState } from 'react'
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
]

interface GeneratingClientProps {
  tripId: string
  destination: string
}

export default function GeneratingClient({ tripId, destination }: GeneratingClientProps) {
  const router = useRouter()
  const [messageIndex, setMessageIndex] = useState(0)
  const [progress, setProgress] = useState(0)
  const [failed, setFailed] = useState(false)

  // Cycle through loading messages
  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((i) => (i + 1) % LOADING_MESSAGES.length)
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  // Poll for advice completion
  useEffect(() => {
    const maxPolls = 60 // 60 × 2s = 2 minutes max wait
    let cancelled = false
    let currentPoll = 0

    const poll = async () => {
      if (cancelled) return

      try {
        const res = await fetch(`/api/advice-status/${tripId}`)
        if (!res.ok) throw new Error('Failed to check status')

        const data = await res.json()
        const pct = Math.round((data.ready / data.total) * 100)
        setProgress(pct)

        if (data.complete) {
          // All done — redirect to the trip home
          router.replace(`/home/${tripId}`)
          return
        }

        currentPoll++
        if (currentPoll >= maxPolls) {
          // Timed out — go to trip page with whatever is available
          router.replace(`/home/${tripId}`)
          return
        }
      } catch {
        setFailed(true)
        return
      }

      // Poll again after 2 seconds (faster feedback)
      if (!cancelled) {
        setTimeout(poll, 2000)
      }
    }

    // Start polling immediately
    const timer = setTimeout(poll, 1000)
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
            Couldn't generate travel advice
          </h1>
          <p className="text-sm text-gray-600 mb-6">
            Your trip to <span className="font-medium">{destination}</span> was saved successfully,
            but we couldn't fetch the AI-generated advice right now. Please check back later —
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
          {LOADING_MESSAGES[messageIndex]}
        </p>

        {/* Progress bar */}
        <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-700 ease-out"
            style={{ width: `${Math.max(progress, 5)}%` }}
          />
        </div>
        <p className="text-xs text-gray-500">{progress}% complete</p>
      </div>
    </main>
  )
}

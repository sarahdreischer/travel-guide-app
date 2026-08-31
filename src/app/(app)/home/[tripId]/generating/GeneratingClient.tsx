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

  // Cycle through loading messages
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

    const timer = setTimeout(poll, 3000)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [tripId, router])

  if (failed) {
    return (
      <div className="generating-shell">
        <div className="generating-body">
          <p className="generating-heading">Couldn&apos;t generate travel briefing</p>
          <p className="generating-sub">
            Your trip to {destination} was saved, but we couldn&apos;t fetch AI advice right now.
            It will be generated on your next visit.
          </p>
          <Link href={`/home/${tripId}`} className="generating-link">
            Go to trip anyway
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="generating-shell">
      <div className="generating-body">
        <p className="generating-heading">
          {complete ? 'Done!' : `Generating advice for ${destination}…`}
        </p>
        <p className="generating-sub">
          {complete ? 'Redirecting you now.' : LOADING_MESSAGES[messageIndex]}
        </p>

        {/* Progress bar */}
        <div className="generating-progress-track" role="progressbar" aria-valuenow={complete ? 100 : progress} aria-valuemin={0} aria-valuemax={100} aria-label="Advice generation progress">
          <div
            className="generating-progress-fill"
            style={{ width: `${complete ? 100 : Math.max(progress, 3)}%` }}
          />
        </div>
        <p className="generating-progress-label">
          {complete ? '100% complete' : `${progress}% complete`}
        </p>
      </div>
    </div>
  )
}

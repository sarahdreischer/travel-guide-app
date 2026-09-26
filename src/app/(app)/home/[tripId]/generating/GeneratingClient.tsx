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

const DEFAULT_TIMEOUT_SECONDS = 30

interface GeneratingClientProps {
  tripId: string
  destination: string
  /** 'new' for a first-time guide, 'update' when refreshing an existing one. */
  mode?: 'new' | 'update'
  timeoutSeconds?: number
}

type StatusData = {
  complete?: boolean
  source?: 'structured' | null
  structuredGuide?: { status?: 'ready' | 'pending' }
}

export default function GeneratingClient({
  tripId,
  destination,
  mode = 'new',
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
          // Carry a marker so the home page shows a "still updating" banner
          // instead of bouncing straight back here (avoids a redirect loop
          // when generation is slow or failing).
          router.replace(`/home/${tripId}?generated=timeout`)
        }
        return next
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [timeoutSeconds, tripId, router])

  // Poll for completion — redirect immediately if done early
  useEffect(() => {
    let cancelled = false

    const goToTrip = () => {
      if (redirected.current) return
      redirected.current = true
      setComplete(true)
      router.replace(`/home/${tripId}`)
    }

    const poll = async () => {
      if (cancelled || redirected.current) return

      try {
        const res = await fetch(`/api/advice-status/${tripId}`)
        if (!res.ok) throw new Error('status check failed')
        const data: StatusData = await res.json()

        // The structured guide is the only advice source — redirect once it's
        // ready. If it never lands, the hard timeout below handles the redirect
        // and the home page shows a "still generating" state.
        if (data.structuredGuide?.status === 'ready' || data.complete) {
          goToTrip()
          return
        }
      } catch {
        // Don't fail — the hard timeout below will handle the redirect.
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
          <p className="generating-heading">
            {mode === 'update' ? 'Couldn\u2019t update travel guidance' : 'Couldn\u2019t generate travel briefing'}
          </p>
          <p className="generating-sub">
            {mode === 'update'
              ? `We couldn\u2019t refresh the guidance for ${destination} right now. Your existing guidance is still available.`
              : `Your trip to ${destination} was saved, but we couldn\u2019t fetch AI advice right now. It will be generated on your next visit.`}
          </p>
          <Link href={`/home/${tripId}`} className="generating-link">
            Go to trip anyway
          </Link>
        </div>
      </div>
    )
  }

  const activeHeading =
    mode === 'update'
      ? `Updating your travel guidance for ${destination}…`
      : `Generating advice for ${destination}…`

  return (
    <div className="generating-shell">
      <div className="generating-body">
        <p className="generating-heading">
          {complete ? 'Done!' : activeHeading}
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

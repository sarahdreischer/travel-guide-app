'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import DeleteTripModal from '@/components/DeleteTripModal'

interface SwipeTripRowProps {
  tripId: string
  destination: string
  href: string
  isPast?: boolean
  children: React.ReactNode
}

/**
 * Wraps a trip row with swipe-to-delete behaviour.
 * Drag left past 80px → red "Delete" zone reveals. On release the confirm modal shows.
 */
export default function SwipeTripRow({ tripId, destination, href, isPast, children }: SwipeTripRowProps) {
  const router = useRouter()
  const [showModal, setShowModal] = useState(false)
  const [offsetX, setOffsetX] = useState(0)
  const startX = useRef(0)
  const dragging = useRef(false)
  const didSwipe = useRef(false)

  function handleTouchStart(e: React.TouchEvent) {
    startX.current = e.touches[0].clientX
    dragging.current = true
    didSwipe.current = false
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (!dragging.current) return
    const diff = e.touches[0].clientX - startX.current
    // Only allow left swipe (negative)
    if (diff < 0) {
      setOffsetX(diff)
    }
  }

  function handleTouchEnd() {
    dragging.current = false
    if (offsetX < -80) {
      // Threshold passed — show delete confirmation
      didSwipe.current = true
      setShowModal(true)
    }
    setOffsetX(0)
  }

  function handleClick(e: React.MouseEvent) {
    // Don't navigate if a swipe just happened
    if (didSwipe.current) {
      e.preventDefault()
      didSwipe.current = false
      return
    }
    router.push(href)
  }

  return (
    <>
      <div className="swipe-row-container">
        {/* Delete zone behind the row — only visible when swiping */}
        {offsetX < 0 && (
          <div className="swipe-row-delete-zone" aria-hidden="true">
            Delete
          </div>
        )}

        {/* The actual row content — entire row translates left on swipe */}
        <div
          className={`trip-row${isPast ? ' is-past' : ''}`}
          style={{ transform: `translateX(${offsetX}px)`, transition: dragging.current ? 'none' : 'transform 0.2s ease' }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onClick={handleClick}
          role="link"
          aria-label={`${destination}`}
        >
          {children}
        </div>
      </div>

      {showModal && (
        <DeleteTripModal
          tripId={tripId}
          destination={destination}
          onCancel={() => setShowModal(false)}
        />
      )}
    </>
  )
}

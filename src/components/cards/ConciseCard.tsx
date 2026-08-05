'use client'

import React from 'react'

export interface ConciseCardProps {
  topic: string // e.g. "Rental car", "Weather conditions"
  summary: string | null // AI summary text, null while loading or on error
  isLoading: boolean // Show skeleton while true
  isExpanded: boolean // Whether the card is in expanded state
  onToggle: () => void // Called when user taps/clicks to expand/collapse
  children?: React.ReactNode // Expanded content to render when isExpanded is true
}

/**
 * ConciseCard — Requirements 5.1, 5.3, 5.5, 5.6, 10.5
 *
 * Displays a summary card for a travel topic. Supports loading, collapsed,
 * and expanded states. Tappable header toggles between collapsed/expanded.
 */
export default function ConciseCard({
  topic,
  summary,
  isLoading,
  isExpanded,
  onToggle,
  children,
}: ConciseCardProps) {
  if (isLoading) {
    return (
      <div
        className="rounded-lg border border-gray-200 p-4 shadow-sm"
        data-testid="concise-card-loading"
      >
        {/* Skeleton placeholder for topic */}
        <div className="animate-pulse bg-gray-200 rounded h-5 w-1/3 mb-3" />
        {/* Skeleton placeholder for summary */}
        <div className="animate-pulse bg-gray-200 rounded h-4 w-full" />
      </div>
    )
  }

  return (
    <div
      className="rounded-lg border border-gray-200 shadow-sm overflow-hidden"
      data-testid="concise-card"
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isExpanded}
        className="w-full min-h-[44px] min-w-[44px] p-4 text-left cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        <h3 className="font-bold text-base text-gray-900">{topic}</h3>
        <p className="mt-1 text-sm text-gray-600">
          {summary || 'Advice unavailable'}
        </p>
      </button>

      {isExpanded && children && (
        <div className="border-t border-gray-200 p-4" data-testid="concise-card-expanded">
          {children}
        </div>
      )}
    </div>
  )
}

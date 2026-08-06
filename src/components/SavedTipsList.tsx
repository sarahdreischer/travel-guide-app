'use client'

import { useTransition, useState } from 'react'
import { toggleSavedTipAction } from '@/actions/saved-tips'

interface SavedTipsListProps {
  tripId: string
  grouped: Record<string, Array<{ id: string; question: string; answer: string }>>
}

function IconBookmarkFilled() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  )
}

function SavedTipItem({ tripId, category, question, answer, onRemoved }: {
  tripId: string
  category: string
  question: string
  answer: string
  onRemoved: () => void
}) {
  const [pending, startTransition] = useTransition()

  function handleRemove() {
    startTransition(async () => {
      await toggleSavedTipAction({ tripId, category, question, answer })
      onRemoved()
    })
  }

  return (
    <div className="category-qa-item">
      <div className="category-qa-header">
        <p className="category-qa-q">{question}</p>
        <button
          type="button"
          className="bookmark-btn bookmark-btn-saved"
          onClick={handleRemove}
          disabled={pending}
          aria-label="Remove from saved tips"
        >
          <IconBookmarkFilled />
        </button>
      </div>
      <p className="category-qa-a">{answer}</p>
    </div>
  )
}

export default function SavedTipsList({ tripId, grouped }: SavedTipsListProps) {
  const [data, setData] = useState(grouped)
  const categories = Object.keys(data).filter((k) => data[k].length > 0)

  function handleRemoved(category: string, question: string) {
    setData((prev) => {
      const updated = { ...prev }
      updated[category] = updated[category].filter((t) => t.question !== question)
      if (updated[category].length === 0) delete updated[category]
      return updated
    })
  }

  if (categories.length === 0) {
    return (
      <div className="empty-state">
        <p className="empty-state-text">All tips have been removed.</p>
      </div>
    )
  }

  return (
    <div className="category-list" style={{ animationName: 'none', opacity: 1 }}>
      {categories.map((category) => (
        <div key={category} className="category-row-wrap">
          <div className="category-lead" style={{ borderBottom: 'none', paddingBottom: 0 }}>
            <p className="category-lead-label">{category}</p>
          </div>
          <div className="category-qa-list" style={{ paddingBottom: 8 }}>
            {data[category].map((tip) => (
              <SavedTipItem
                key={tip.question}
                tripId={tripId}
                category={category}
                question={tip.question}
                answer={tip.answer}
                onRemoved={() => handleRemoved(category, tip.question)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

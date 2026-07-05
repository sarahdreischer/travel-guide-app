'use client'

import React, { useState } from 'react'
import ConciseCard from '@/components/cards/ConciseCard'

export interface CardData {
  topic: string
  summary: string | null
  category: string
  answers: Record<string, string> | null
}

interface HomeCardGridProps {
  cards: CardData[]
}

/**
 * HomeCardGrid — Requirements 5.1, 5.2, 5.3
 *
 * Client Component that renders a responsive grid of ConciseCards
 * and manages expand/collapse state per card.
 */
export default function HomeCardGrid({ cards }: HomeCardGridProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null)

  function handleToggle(index: number) {
    setExpandedIndex((prev) => (prev === index ? null : index))
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {cards.map((card, index) => (
        <ConciseCard
          key={card.topic}
          topic={card.topic}
          summary={card.summary}
          isLoading={false}
          isExpanded={expandedIndex === index}
          onToggle={() => handleToggle(index)}
        >
          {expandedIndex === index && card.answers && (
            <div className="space-y-2">
              {Object.entries(card.answers).map(([question, answer]) => (
                <div key={question}>
                  <p className="text-sm font-medium text-gray-700">{question}</p>
                  <p className="text-sm text-gray-600">{answer || 'Not applicable'}</p>
                </div>
              ))}
            </div>
          )}
        </ConciseCard>
      ))}
    </div>
  )
}

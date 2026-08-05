'use client'

import React from 'react'
import { getSubQuestions } from '@/lib/sub-questions'
import { findAnswer } from '@/lib/answer-lookup'
import type { Category } from '@/lib/destinations'
import type { AdviceCache } from '@/db/schema'
import VoteButtons from '@/components/voting/VoteButtons'

export interface ExpandedCardProps {
  category: string // One of the 15 categories
  adviceRecord: AdviceCache | null // The full advice record with answers, null while loading
  isLoading: boolean // Show loading state
  conciseAnswer?: string // The one-sentence summary for the concise view
  adviceId?: string | null // The advice record ID for voting
  userVoteType?: 'accurate' | 'outdated' | 'none' | null // The user's current vote on this advice
  userNote?: string | null // The user's current experience note
}

/**
 * Determines the "Recommended?" indicator value by checking the first sub-question
 * answer for yes/no patterns (e.g. "Is driving recommended?").
 */
function getRecommendedStatus(
  category: string,
  answers: Record<string, string> | null | undefined
): 'Yes' | 'No' | 'Unknown' {
  if (!answers) return 'Unknown'

  const subQuestions = getSubQuestions(category as Category)
  const firstQuestion = subQuestions[0]
  if (!firstQuestion) return 'Unknown'

  const answer = findAnswer(answers, firstQuestion)
  if (!answer) return 'Unknown'

  const lowerAnswer = answer.toLowerCase()
  if (lowerAnswer.startsWith('no') || lowerAnswer.includes('not recommended')) {
    return 'No'
  }
  if (lowerAnswer.startsWith('yes') || lowerAnswer.includes('recommended')) {
    return 'Yes'
  }

  return 'Unknown'
}

/**
 * ExpandedCard — Requirements 6.1, 6.2, 6.3, 6.4, 6.5
 *
 * Renders the full detail view for a category:
 * - Topic name heading
 * - "Recommended?" indicator badge (Yes/No/Unknown)
 * - Concise-view answer summary
 * - All sub-questions with their AI-generated answers
 * - "Not applicable" for absent answers
 * - Loading skeleton per sub-question while advice is pending
 */
export default function ExpandedCard({
  category,
  adviceRecord,
  isLoading,
  conciseAnswer,
  adviceId,
  userVoteType,
  userNote,
}: ExpandedCardProps) {
  const subQuestions = getSubQuestions(category as Category)
  const answers = adviceRecord?.answers as Record<string, string> | null | undefined
  const recommendedStatus = getRecommendedStatus(category, answers)

  const badgeColor =
    recommendedStatus === 'Yes'
      ? 'bg-green-100 text-green-800'
      : recommendedStatus === 'No'
        ? 'bg-red-100 text-red-800'
        : 'bg-gray-100 text-gray-800'

  return (
    <div data-testid="expanded-card" className="space-y-4">
      {/* Topic name */}
      <h2 className="text-lg font-bold text-gray-900" data-testid="expanded-card-topic">
        {category}
      </h2>

      {/* Recommended indicator */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-700">Recommended?</span>
        <span
          className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${badgeColor}`}
          data-testid="expanded-card-recommended"
        >
          {recommendedStatus}
        </span>
      </div>

      {/* Concise-view answer */}
      {conciseAnswer && (
        <div className="border-b border-gray-200 pb-3" data-testid="expanded-card-concise">
          <p className="text-sm text-gray-700 italic">{conciseAnswer}</p>
        </div>
      )}

      {/* Sub-questions section */}
      <div className="space-y-3" data-testid="expanded-card-questions">
        {subQuestions.map((question) => {
          const answer = findAnswer(answers, question)
          const hasAnswer = answer !== undefined && answer !== null && answer !== ''

          return (
            <div
              key={question}
              className="border-b border-gray-100 pb-3 last:border-b-0"
              data-testid="expanded-card-question-section"
            >
              <h3 className="text-sm font-semibold text-gray-800 mb-1">{question}</h3>
              {isLoading && !hasAnswer ? (
                <div
                  className="animate-pulse bg-gray-200 rounded h-4 w-3/4"
                  data-testid="expanded-card-skeleton"
                />
              ) : (
                <p
                  className="text-sm text-gray-600"
                  data-testid="expanded-card-answer"
                >
                  {hasAnswer ? answer : 'Not applicable'}
                </p>
              )}
            </div>
          )
        })}
      </div>

      {/* Vote buttons — Req 7.1, 7.5 */}
      {adviceId && !isLoading && (
        <div data-testid="expanded-card-vote-buttons">
          <VoteButtons
            adviceId={adviceId}
            currentVote={userVoteType ?? null}
            currentNote={userNote}
          />
        </div>
      )}
    </div>
  )
}

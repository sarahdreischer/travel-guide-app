/**
 * @jest-environment jsdom
 */
import React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'

// Mock VoteButtons to avoid pulling in server-side dependencies (pg, drizzle)
jest.mock('@/components/voting/VoteButtons', () => {
  return function MockVoteButtons({ adviceId, currentVote, currentNote }: { adviceId: string; currentVote: string | null; currentNote?: string | null }) {
    return (
      <div data-testid="mock-vote-buttons" data-advice-id={adviceId} data-vote={currentVote} data-note={currentNote}>
        VoteButtons
      </div>
    )
  }
})

import ExpandedCard from './ExpandedCard'

describe('ExpandedCard', () => {
  const category = 'Transportation – Self Driving'

  const mockAdviceRecord = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    destination: 'Costa Rica',
    startMonth: 'january', endMonth: 'january',
    travellerType: 'solo',
    budgetRange: 'mid',
    category,
    answers: {
      'Is driving recommended?': 'Yes, driving is highly recommended for exploring.',
      'Are roads easy to drive on?': 'Main roads are good, secondary roads can be rough.',
      'Are mountain roads difficult?': 'Some mountain roads are steep and winding.',
    },
    generatedAt: new Date(),
  }

  it('renders the topic name as a heading', () => {
    render(
      <ExpandedCard
        category={category}
        adviceRecord={mockAdviceRecord}
        isLoading={false}
      />
    )

    expect(screen.getByTestId('expanded-card-topic')).toHaveTextContent(category)
  })

  it('renders "Yes" recommended badge when first answer starts with yes', () => {
    render(
      <ExpandedCard
        category={category}
        adviceRecord={mockAdviceRecord}
        isLoading={false}
      />
    )

    const badge = screen.getByTestId('expanded-card-recommended')
    expect(badge).toHaveTextContent('Yes')
    expect(badge.className).toContain('bg-green-100')
  })

  it('renders "No" recommended badge when first answer starts with no', () => {
    const noRecord = {
      ...mockAdviceRecord,
      answers: {
        ...mockAdviceRecord.answers,
        'Is driving recommended?': 'No, driving is not recommended due to poor roads.',
      },
    }

    render(
      <ExpandedCard
        category={category}
        adviceRecord={noRecord}
        isLoading={false}
      />
    )

    const badge = screen.getByTestId('expanded-card-recommended')
    expect(badge).toHaveTextContent('No')
    expect(badge.className).toContain('bg-red-100')
  })

  it('renders "Unknown" recommended badge when adviceRecord is null', () => {
    render(
      <ExpandedCard
        category={category}
        adviceRecord={null}
        isLoading={true}
      />
    )

    const badge = screen.getByTestId('expanded-card-recommended')
    expect(badge).toHaveTextContent('Unknown')
    expect(badge.className).toContain('bg-gray-100')
  })

  it('renders the concise answer when provided', () => {
    render(
      <ExpandedCard
        category={category}
        adviceRecord={mockAdviceRecord}
        isLoading={false}
        conciseAnswer="Driving is recommended for most areas."
      />
    )

    expect(screen.getByTestId('expanded-card-concise')).toHaveTextContent(
      'Driving is recommended for most areas.'
    )
  })

  it('does not render concise section when conciseAnswer is not provided', () => {
    render(
      <ExpandedCard
        category={category}
        adviceRecord={mockAdviceRecord}
        isLoading={false}
      />
    )

    expect(screen.queryByTestId('expanded-card-concise')).not.toBeInTheDocument()
  })

  it('renders all sub-questions for the category', () => {
    render(
      <ExpandedCard
        category={category}
        adviceRecord={mockAdviceRecord}
        isLoading={false}
      />
    )

    const sections = screen.getAllByTestId('expanded-card-question-section')
    // Transportation – Self Driving has 3 sub-questions
    expect(sections).toHaveLength(3)
  })

  it('renders "Not applicable" for missing answers (Req 6.3)', () => {
    const partialRecord = {
      ...mockAdviceRecord,
      answers: {
        'Is driving recommended?': 'Yes, driving is recommended.',
        // Other questions have no answers
      },
    }

    render(
      <ExpandedCard
        category={category}
        adviceRecord={partialRecord}
        isLoading={false}
      />
    )

    const answers = screen.getAllByTestId('expanded-card-answer')
    const notApplicableAnswers = answers.filter(
      (el) => el.textContent === 'Not applicable'
    )
    // 2 out of 3 should be "Not applicable"
    expect(notApplicableAnswers).toHaveLength(2)
  })

  it('shows loading skeletons for unanswered questions when isLoading is true (Req 6.5)', () => {
    const partialRecord = {
      ...mockAdviceRecord,
      answers: {
        'Is driving recommended?': 'Yes, driving is recommended.',
      },
    }

    render(
      <ExpandedCard
        category={category}
        adviceRecord={partialRecord}
        isLoading={true}
      />
    )

    const skeletons = screen.getAllByTestId('expanded-card-skeleton')
    // 6 unanswered questions should show skeletons
    expect(skeletons).toHaveLength(2)
  })

  it('shows loading skeletons for all questions when adviceRecord is null and isLoading is true', () => {
    render(
      <ExpandedCard
        category={category}
        adviceRecord={null}
        isLoading={true}
      />
    )

    const skeletons = screen.getAllByTestId('expanded-card-skeleton')
    expect(skeletons).toHaveLength(3)
  })

  it('renders actual answers when available even while loading', () => {
    render(
      <ExpandedCard
        category={category}
        adviceRecord={mockAdviceRecord}
        isLoading={true}
      />
    )

    // All 3 answers are present, so no skeletons should show
    expect(screen.queryByTestId('expanded-card-skeleton')).not.toBeInTheDocument()
    const answers = screen.getAllByTestId('expanded-card-answer')
    expect(answers).toHaveLength(3)
  })

  it('renders VoteButtons when adviceId is provided and not loading (Req 7.1, 7.5)', () => {
    render(
      <ExpandedCard
        category={category}
        adviceRecord={mockAdviceRecord}
        isLoading={false}
        adviceId="advice-123"
        userVoteType="accurate"
        userNote="Great advice!"
      />
    )

    const voteButtons = screen.getByTestId('mock-vote-buttons')
    expect(voteButtons).toBeInTheDocument()
    expect(voteButtons).toHaveAttribute('data-advice-id', 'advice-123')
    expect(voteButtons).toHaveAttribute('data-vote', 'accurate')
    expect(voteButtons).toHaveAttribute('data-note', 'Great advice!')
  })

  it('does not render VoteButtons when adviceId is not provided', () => {
    render(
      <ExpandedCard
        category={category}
        adviceRecord={mockAdviceRecord}
        isLoading={false}
      />
    )

    expect(screen.queryByTestId('mock-vote-buttons')).not.toBeInTheDocument()
  })

  it('does not render VoteButtons when isLoading is true', () => {
    render(
      <ExpandedCard
        category={category}
        adviceRecord={mockAdviceRecord}
        isLoading={true}
        adviceId="advice-123"
      />
    )

    expect(screen.queryByTestId('mock-vote-buttons')).not.toBeInTheDocument()
  })

  it('renders VoteButtons with null currentVote when userVoteType is not provided', () => {
    render(
      <ExpandedCard
        category={category}
        adviceRecord={mockAdviceRecord}
        isLoading={false}
        adviceId="advice-456"
      />
    )

    const voteButtons = screen.getByTestId('mock-vote-buttons')
    expect(voteButtons).toBeInTheDocument()
    expect(voteButtons).toHaveAttribute('data-advice-id', 'advice-456')
    // currentVote is null when userVoteType is not provided, so data-vote won't be set
    expect(voteButtons).not.toHaveAttribute('data-vote', 'accurate')
    expect(voteButtons).not.toHaveAttribute('data-vote', 'outdated')
  })
})

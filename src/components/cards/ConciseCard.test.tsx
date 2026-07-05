/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import ConciseCard from './ConciseCard'

describe('ConciseCard', () => {
  const defaultProps = {
    topic: 'Rental car',
    summary: 'Renting a car is recommended for exploring the coast.',
    isLoading: false,
    isExpanded: false,
    onToggle: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Loading state', () => {
    it('renders a loading skeleton when isLoading is true', () => {
      render(<ConciseCard {...defaultProps} isLoading={true} />)

      const skeleton = screen.getByTestId('concise-card-loading')
      expect(skeleton).toBeInTheDocument()
      // Should contain animate-pulse elements
      const pulseElements = skeleton.querySelectorAll('.animate-pulse')
      expect(pulseElements.length).toBeGreaterThanOrEqual(1)
    })

    it('does not render topic or summary text when loading', () => {
      render(<ConciseCard {...defaultProps} isLoading={true} />)

      expect(screen.queryByText('Rental car')).not.toBeInTheDocument()
      expect(screen.queryByText(defaultProps.summary!)).not.toBeInTheDocument()
    })
  })

  describe('Collapsed state', () => {
    it('renders the topic as a heading', () => {
      render(<ConciseCard {...defaultProps} />)

      expect(screen.getByRole('heading', { name: 'Rental car' })).toBeInTheDocument()
    })

    it('renders the summary text', () => {
      render(<ConciseCard {...defaultProps} />)

      expect(screen.getByText(defaultProps.summary!)).toBeInTheDocument()
    })

    it('does not render expanded children content', () => {
      render(
        <ConciseCard {...defaultProps}>
          <div data-testid="expanded-content">Detailed info</div>
        </ConciseCard>
      )

      expect(screen.queryByTestId('concise-card-expanded')).not.toBeInTheDocument()
    })

    it('shows "Advice unavailable" when summary is null', () => {
      render(<ConciseCard {...defaultProps} summary={null} />)

      expect(screen.getByText('Advice unavailable')).toBeInTheDocument()
    })

    it('shows "Advice unavailable" when summary is empty string', () => {
      render(<ConciseCard {...defaultProps} summary="" />)

      expect(screen.getByText('Advice unavailable')).toBeInTheDocument()
    })
  })

  describe('Expanded state', () => {
    it('renders children when isExpanded is true', () => {
      render(
        <ConciseCard {...defaultProps} isExpanded={true}>
          <div data-testid="expanded-content">Detailed info</div>
        </ConciseCard>
      )

      expect(screen.getByTestId('concise-card-expanded')).toBeInTheDocument()
      expect(screen.getByText('Detailed info')).toBeInTheDocument()
    })

    it('still shows topic and summary when expanded', () => {
      render(
        <ConciseCard {...defaultProps} isExpanded={true}>
          <div>Extra content</div>
        </ConciseCard>
      )

      expect(screen.getByRole('heading', { name: 'Rental car' })).toBeInTheDocument()
      expect(screen.getByText(defaultProps.summary!)).toBeInTheDocument()
    })
  })

  describe('Interaction', () => {
    it('calls onToggle when the card header is clicked', () => {
      const onToggle = jest.fn()
      render(<ConciseCard {...defaultProps} onToggle={onToggle} />)

      const button = screen.getByRole('button')
      fireEvent.click(button)

      expect(onToggle).toHaveBeenCalledTimes(1)
    })
  })

  describe('Accessibility', () => {
    it('uses a button element for the clickable header', () => {
      render(<ConciseCard {...defaultProps} />)

      const button = screen.getByRole('button')
      expect(button).toBeInTheDocument()
    })

    it('sets aria-expanded to false when collapsed', () => {
      render(<ConciseCard {...defaultProps} isExpanded={false} />)

      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('aria-expanded', 'false')
    })

    it('sets aria-expanded to true when expanded', () => {
      render(<ConciseCard {...defaultProps} isExpanded={true} />)

      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('aria-expanded', 'true')
    })

    it('has minimum 44x44 touch target on the button', () => {
      render(<ConciseCard {...defaultProps} />)

      const button = screen.getByRole('button')
      expect(button.className).toContain('min-h-[44px]')
      expect(button.className).toContain('min-w-[44px]')
    })
  })
})

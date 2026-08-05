/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import Input from './Input'

describe('Input', () => {
  it('renders label associated with input via htmlFor', () => {
    render(<Input id="email" label="Email" />)
    const input = screen.getByLabelText('Email')
    expect(input).toBeInTheDocument()
    expect(input).toHaveAttribute('id', 'email')
  })

  it('has minimum 44x44 touch target', () => {
    render(<Input id="name" label="Name" />)
    const input = screen.getByLabelText('Name')
    expect(input.className).toContain('min-h-[44px]')
    expect(input.className).toContain('min-w-[44px]')
  })

  it('does not show error message when no error is provided', () => {
    render(<Input id="test" label="Test" />)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows error message with role=alert when error is provided', () => {
    render(<Input id="email" label="Email" error="Email is required" />)
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Email is required')
  })

  it('applies red border when in error state', () => {
    render(<Input id="email" label="Email" error="Required" />)
    const input = screen.getByLabelText('Email')
    expect(input.className).toContain('border-red-500')
  })

  it('sets aria-invalid=true when error is present', () => {
    render(<Input id="email" label="Email" error="Invalid email" />)
    const input = screen.getByLabelText('Email')
    expect(input).toHaveAttribute('aria-invalid', 'true')
  })

  it('does not set aria-invalid when no error', () => {
    render(<Input id="email" label="Email" />)
    const input = screen.getByLabelText('Email')
    expect(input).not.toHaveAttribute('aria-invalid')
  })

  it('sets aria-describedby pointing to error message', () => {
    render(<Input id="email" label="Email" error="Invalid" />)
    const input = screen.getByLabelText('Email')
    expect(input).toHaveAttribute('aria-describedby', 'email-error')
    const errorEl = document.getElementById('email-error')
    expect(errorEl).toHaveTextContent('Invalid')
  })

  it('does not set aria-describedby when no error', () => {
    render(<Input id="email" label="Email" />)
    const input = screen.getByLabelText('Email')
    expect(input).not.toHaveAttribute('aria-describedby')
  })

  it('passes through additional HTML attributes', () => {
    render(<Input id="email" label="Email" type="email" placeholder="you@example.com" />)
    const input = screen.getByLabelText('Email')
    expect(input).toHaveAttribute('type', 'email')
    expect(input).toHaveAttribute('placeholder', 'you@example.com')
  })
})

/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import Button from './Button'

describe('Button', () => {
  it('renders children text', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument()
  })

  it('applies primary variant styles by default', () => {
    render(<Button>Primary</Button>)
    const button = screen.getByRole('button')
    expect(button.className).toContain('bg-blue-600')
    expect(button.className).toContain('text-white')
  })

  it('applies secondary variant styles', () => {
    render(<Button variant="secondary">Secondary</Button>)
    const button = screen.getByRole('button')
    expect(button.className).toContain('bg-white')
    expect(button.className).toContain('text-gray-700')
    expect(button.className).toContain('border-gray-300')
  })

  it('applies destructive variant styles', () => {
    render(<Button variant="destructive">Delete</Button>)
    const button = screen.getByRole('button')
    expect(button.className).toContain('bg-red-600')
    expect(button.className).toContain('text-white')
  })

  it('has minimum 44x44 touch target', () => {
    render(<Button>Touch</Button>)
    const button = screen.getByRole('button')
    expect(button.className).toContain('min-h-[44px]')
    expect(button.className).toContain('min-w-[44px]')
  })

  it('disables button and shows spinner when isLoading is true', () => {
    render(<Button isLoading>Loading</Button>)
    const button = screen.getByRole('button')
    expect(button).toBeDisabled()
    expect(button.querySelector('svg')).toBeInTheDocument()
  })

  it('applies disabled styles when disabled', () => {
    render(<Button disabled>Disabled</Button>)
    const button = screen.getByRole('button')
    expect(button).toBeDisabled()
    expect(button.className).toContain('disabled:opacity-50')
    expect(button.className).toContain('disabled:cursor-not-allowed')
  })

  it('sets aria-disabled when loading', () => {
    render(<Button isLoading>Loading</Button>)
    const button = screen.getByRole('button')
    expect(button).toHaveAttribute('aria-disabled', 'true')
  })

  it('has focus-visible outline styles', () => {
    render(<Button>Focus</Button>)
    const button = screen.getByRole('button')
    expect(button.className).toContain('focus-visible:outline-2')
    expect(button.className).toContain('focus-visible:outline-offset-2')
  })

  it('passes through additional HTML attributes', () => {
    render(<Button type="submit" data-testid="my-btn">Submit</Button>)
    const button = screen.getByTestId('my-btn')
    expect(button).toHaveAttribute('type', 'submit')
  })
})

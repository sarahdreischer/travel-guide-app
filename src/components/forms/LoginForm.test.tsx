/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import LoginForm from './LoginForm'

// Mock the loginAction server action
jest.mock('@/actions/auth', () => ({
  loginAction: jest.fn(),
}))

// Mock react's useActionState and preserve useState/useCallback
const mockFormAction = jest.fn()
let mockState: { error?: { type: string; message: string; remainingMinutes?: number } } | null = null

jest.mock('react', () => {
  const actualReact = jest.requireActual('react')
  return {
    ...actualReact,
    useActionState: () => [mockState, mockFormAction],
  }
})

// Mock react-dom useFormStatus
let mockPending = false
jest.mock('react-dom', () => {
  const actualReactDom = jest.requireActual('react-dom')
  return {
    ...actualReactDom,
    useFormStatus: () => ({ pending: mockPending }),
  }
})

describe('LoginForm', () => {
  beforeEach(() => {
    mockState = null
    mockPending = false
  })

  it('renders email and password inputs with labels', () => {
    render(<LoginForm />)

    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toHaveAttribute('type', 'email')
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password')
  })

  it('renders a Log in submit button', () => {
    render(<LoginForm />)

    const button = screen.getByRole('button', { name: /log in/i })
    expect(button).toBeInTheDocument()
    expect(button).toHaveAttribute('type', 'submit')
  })

  it('interactive elements use the shared field/button classes (44px sizing enforced via CSS)', () => {
    render(<LoginForm />)

    const email = screen.getByLabelText('Email')
    const password = screen.getByLabelText('Password')
    const button = screen.getByRole('button', { name: /log in/i })

    // Inputs use the .field-input class and the submit button uses .btn-primary;
    // the global stylesheet enforces a 44px minimum touch target on these.
    expect(email.className).toContain('field-input')
    expect(password.className).toContain('field-input')
    expect(button.className).toContain('btn-primary')
  })

  it('shows inline error message when invalid credentials', () => {
    mockState = {
      error: {
        type: 'invalid_credentials',
        message: 'Email or password is incorrect.',
      },
    }

    render(<LoginForm />)

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Email or password is incorrect.')
  })

  it('shows lock message when account is locked', () => {
    mockState = {
      error: {
        type: 'account_locked',
        message: 'Account is temporarily locked.',
        remainingMinutes: 12,
      },
    }

    render(<LoginForm />)

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent(/temporarily locked/i)
    expect(alert).toHaveTextContent('12')
    expect(alert).toHaveTextContent('min')
  })

  it('shows the remaining lock time when 1 minute remaining', () => {
    mockState = {
      error: {
        type: 'account_locked',
        message: 'Account is temporarily locked.',
        remainingMinutes: 1,
      },
    }

    render(<LoginForm />)

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('1 min.')
  })

  it('does not show error message when state is null', () => {
    mockState = null
    render(<LoginForm />)

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('disables button when form is submitting', () => {
    mockPending = true
    render(<LoginForm />)

    const button = screen.getByRole('button', { name: /logging in/i })
    expect(button).toBeDisabled()
  })

  it('dismisses error message when user modifies email input', () => {
    mockState = {
      error: {
        type: 'invalid_credentials',
        message: 'Email or password is incorrect.',
      },
    }

    render(<LoginForm />)

    // Error is visible initially
    expect(screen.getByRole('alert')).toBeInTheDocument()

    // User types in email field
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'new@email.com' } })

    // Error should be dismissed
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('dismisses error message when user modifies password input', () => {
    mockState = {
      error: {
        type: 'invalid_credentials',
        message: 'Email or password is incorrect.',
      },
    }

    render(<LoginForm />)

    expect(screen.getByRole('alert')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'newpass' } })

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

import { loginAction, logoutAction } from '@/actions/auth'

// Mock next/headers cookies
const mockSet = jest.fn()
const mockGet = jest.fn()
const mockDelete = jest.fn()

jest.mock('next/headers', () => ({
  cookies: jest.fn().mockResolvedValue({
    set: (...args: unknown[]) => mockSet(...args),
    get: (...args: unknown[]) => mockGet(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
  }),
}))

// Mock next/navigation redirect
const mockRedirect = jest.fn()
jest.mock('next/navigation', () => ({
  redirect: (...args: unknown[]) => {
    mockRedirect(...args)
    // Simulate Next.js redirect throwing a special error
    throw new Error('NEXT_REDIRECT')
  },
}))

// Mock AuthService
const mockLogin = jest.fn()
const mockLogout = jest.fn()

jest.mock('@/lib/auth', () => ({
  AuthService: {
    login: (...args: unknown[]) => mockLogin(...args),
    logout: (...args: unknown[]) => mockLogout(...args),
  },
}))

describe('Auth Server Actions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('loginAction', () => {
    it('returns error when AuthService.login fails with invalid_credentials', async () => {
      mockLogin.mockResolvedValue({
        success: false,
        error: {
          type: 'invalid_credentials',
          message: 'Email or password is incorrect.',
        },
      })

      const formData = new FormData()
      formData.set('email', 'test@example.com')
      formData.set('password', 'wrongpassword')

      const result = await loginAction(null, formData)

      expect(result).toEqual({
        error: {
          type: 'invalid_credentials',
          message: 'Email or password is incorrect.',
        },
      })
      expect(mockSet).not.toHaveBeenCalled()
      expect(mockRedirect).not.toHaveBeenCalled()
    })

    it('returns error when AuthService.login fails with account_locked', async () => {
      mockLogin.mockResolvedValue({
        success: false,
        error: {
          type: 'account_locked',
          message: 'Account is temporarily locked due to too many failed login attempts.',
          remainingMinutes: 12,
        },
      })

      const formData = new FormData()
      formData.set('email', 'test@example.com')
      formData.set('password', 'password')

      const result = await loginAction(null, formData)

      expect(result).toEqual({
        error: {
          type: 'account_locked',
          message: 'Account is temporarily locked due to too many failed login attempts.',
          remainingMinutes: 12,
        },
      })
      expect(mockSet).not.toHaveBeenCalled()
      expect(mockRedirect).not.toHaveBeenCalled()
    })

    it('sets session cookie and redirects to /home on success', async () => {
      const expiresAt = new Date(Date.now() + 86400 * 1000)
      mockLogin.mockResolvedValue({
        success: true,
        token: 'abc123token',
        expiresAt,
      })

      const formData = new FormData()
      formData.set('email', 'test@example.com')
      formData.set('password', 'correctpassword')

      // redirect throws, so we catch the error
      await expect(loginAction(null, formData)).rejects.toThrow('NEXT_REDIRECT')

      expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'correctpassword')
      expect(mockSet).toHaveBeenCalledWith('session_token', 'abc123token', {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 86400,
      })
      expect(mockRedirect).toHaveBeenCalledWith('/home')
    })

    it('passes email and password from FormData to AuthService.login', async () => {
      mockLogin.mockResolvedValue({
        success: false,
        error: { type: 'invalid_credentials', message: 'Email or password is incorrect.' },
      })

      const formData = new FormData()
      formData.set('email', 'user@domain.com')
      formData.set('password', 'mySecret123')

      await loginAction(null, formData)

      expect(mockLogin).toHaveBeenCalledWith('user@domain.com', 'mySecret123')
    })
  })

  describe('logoutAction', () => {
    it('calls AuthService.logout with the session token and redirects to /login', async () => {
      mockGet.mockReturnValue({ value: 'existing-session-token' })
      mockLogout.mockResolvedValue(undefined)

      await expect(logoutAction()).rejects.toThrow('NEXT_REDIRECT')

      expect(mockLogout).toHaveBeenCalledWith('existing-session-token')
      expect(mockDelete).toHaveBeenCalledWith('session_token')
      expect(mockRedirect).toHaveBeenCalledWith('/login')
    })

    it('skips AuthService.logout when no session cookie exists', async () => {
      mockGet.mockReturnValue(undefined)

      await expect(logoutAction()).rejects.toThrow('NEXT_REDIRECT')

      expect(mockLogout).not.toHaveBeenCalled()
      expect(mockDelete).toHaveBeenCalledWith('session_token')
      expect(mockRedirect).toHaveBeenCalledWith('/login')
    })
  })
})

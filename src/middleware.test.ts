import { middleware } from './middleware'
import { NextRequest } from 'next/server'

function createRequest(
  path: string,
  cookies: Record<string, string> = {}
): NextRequest {
  const url = `http://localhost:3000${path}`
  const req = new NextRequest(new URL(url), {
    headers: new Headers(),
  })
  for (const [name, value] of Object.entries(cookies)) {
    req.cookies.set(name, value)
  }
  return req
}

describe('middleware — session guard for (app)/** routes', () => {
  it('redirects to /login when session_token cookie is missing', () => {
    const req = createRequest('/home/some-trip-id')
    const res = middleware(req)

    expect(res.status).toBe(307)
    expect(new URL(res.headers.get('location')!).pathname).toBe('/login')
  })

  it('redirects to /login when session_token cookie is empty', () => {
    const req = createRequest('/destinations', { session_token: '' })
    const res = middleware(req)

    expect(res.status).toBe(307)
    expect(new URL(res.headers.get('location')!).pathname).toBe('/login')
  })

  it('redirects to /setup when session_token exists but setup_complete is missing', () => {
    const req = createRequest('/home/abc', { session_token: 'valid-token' })
    const res = middleware(req)

    expect(res.status).toBe(307)
    expect(new URL(res.headers.get('location')!).pathname).toBe('/setup')
  })

  it('redirects to /setup when setup_complete is not "true"', () => {
    const req = createRequest('/trip/new', {
      session_token: 'valid-token',
      setup_complete: 'false',
    })
    const res = middleware(req)

    expect(res.status).toBe(307)
    expect(new URL(res.headers.get('location')!).pathname).toBe('/setup')
  })

  it('passes through when both session_token and setup_complete=true exist', () => {
    const req = createRequest('/profile/settings', {
      session_token: 'valid-token',
      setup_complete: 'true',
    })
    const res = middleware(req)

    // NextResponse.next() returns a 200 status (pass-through)
    expect(res.status).toBe(200)
    expect(res.headers.get('location')).toBeNull()
  })

  it('passes through for all matched routes when authenticated and setup complete', () => {
    const paths = ['/home/trip-123', '/destinations', '/trip/new', '/profile']
    for (const path of paths) {
      const req = createRequest(path, {
        session_token: 'some-token',
        setup_complete: 'true',
      })
      const res = middleware(req)
      expect(res.status).toBe(200)
    }
  })
})

describe('middleware — /setup route handling', () => {
  it('allows access to /setup when no session_token is present (guest)', () => {
    const req = createRequest('/setup')
    const res = middleware(req)

    expect(res.status).toBe(200)
    expect(res.headers.get('location')).toBeNull()
  })

  it('allows access to /setup when session_token exists but setup_complete is missing', () => {
    const req = createRequest('/setup', { session_token: 'valid-token' })
    const res = middleware(req)

    expect(res.status).toBe(200)
    expect(res.headers.get('location')).toBeNull()
  })

  it('allows access to /setup when session_token exists but setup_complete is not "true"', () => {
    const req = createRequest('/setup', {
      session_token: 'valid-token',
      setup_complete: 'false',
    })
    const res = middleware(req)

    expect(res.status).toBe(200)
    expect(res.headers.get('location')).toBeNull()
  })

  it('redirects to /home when session_token and setup_complete=true are both present', () => {
    const req = createRequest('/setup', {
      session_token: 'valid-token',
      setup_complete: 'true',
    })
    const res = middleware(req)

    expect(res.status).toBe(307)
    expect(new URL(res.headers.get('location')!).pathname).toBe('/home')
  })
})

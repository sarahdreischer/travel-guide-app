// Mock the database module to avoid requiring DATABASE_URL in tests
jest.mock('@/db', () => ({
  db: {
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
}))

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('$2b$12$hashedpassword'),
}))

import { ProfileService } from './profile'

// ─── validateImage (pure logic, no DB) ────────────────────────────────────────

describe('ProfileService.validateImage', () => {
  const FIVE_MB = 5_242_880

  it('accepts a valid JPEG under 5 MB', () => {
    expect(ProfileService.validateImage({ mimeType: 'image/jpeg', size: 1024 })).toEqual({
      valid: true,
    })
  })

  it('accepts a valid PNG at exactly 5 MB', () => {
    expect(ProfileService.validateImage({ mimeType: 'image/png', size: FIVE_MB })).toEqual({
      valid: true,
    })
  })

  it('accepts a valid WebP file', () => {
    expect(ProfileService.validateImage({ mimeType: 'image/webp', size: 2_000_000 })).toEqual({
      valid: true,
    })
  })

  it('rejects an unsupported MIME type (image/gif)', () => {
    expect(ProfileService.validateImage({ mimeType: 'image/gif', size: 1024 })).toEqual({
      valid: false,
      error: 'invalid_format',
    })
  })

  it('rejects a file exceeding 5 MB', () => {
    expect(
      ProfileService.validateImage({ mimeType: 'image/jpeg', size: FIVE_MB + 1 }),
    ).toEqual({ valid: false, error: 'file_too_large' })
  })

  it('reports invalid_format before file_too_large when both fail', () => {
    expect(
      ProfileService.validateImage({ mimeType: 'text/plain', size: FIVE_MB + 1 }),
    ).toEqual({ valid: false, error: 'invalid_format' })
  })
})

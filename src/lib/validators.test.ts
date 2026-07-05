import {
  derivebudgetRange,
  validateUsername,
  validateExperienceNote,
  validateProfileImage,
  validateEmail,
  validateTripDates,
  normaliseCacheKey,
  type CacheKey,
} from './validators'

// ─── derivebudgetRange ────────────────────────────────────────────────────────

describe('derivebudgetRange', () => {
  it('returns budget for $1 (lower bound)', () => {
    expect(derivebudgetRange(1)).toBe('budget')
  })

  it('returns budget for $99 (upper bound of budget tier)', () => {
    expect(derivebudgetRange(99)).toBe('budget')
  })

  it('returns mid for $100 (lower bound of mid tier)', () => {
    expect(derivebudgetRange(100)).toBe('mid')
  })

  it('returns mid for $499 (upper bound of mid tier)', () => {
    expect(derivebudgetRange(499)).toBe('mid')
  })

  it('returns luxury for $500 (lower bound of luxury tier)', () => {
    expect(derivebudgetRange(500)).toBe('luxury')
  })

  it('returns luxury for $1,000,000 (upper bound)', () => {
    expect(derivebudgetRange(1_000_000)).toBe('luxury')
  })

  it('throws RangeError for $0', () => {
    expect(() => derivebudgetRange(0)).toThrow(RangeError)
  })

  it('throws RangeError for negative values', () => {
    expect(() => derivebudgetRange(-1)).toThrow(RangeError)
  })

  it('throws RangeError for values above 1,000,000', () => {
    expect(() => derivebudgetRange(1_000_001)).toThrow(RangeError)
  })
})

// ─── validateUsername ─────────────────────────────────────────────────────────

describe('validateUsername', () => {
  it('accepts a single character (length 1)', () => {
    expect(validateUsername('a')).toBe(true)
  })

  it('accepts a 255-character username (upper bound)', () => {
    expect(validateUsername('a'.repeat(255))).toBe(true)
  })

  it('rejects an empty string (length 0)', () => {
    expect(validateUsername('')).toBe(false)
  })

  it('rejects a 256-character username (over limit)', () => {
    expect(validateUsername('a'.repeat(256))).toBe(false)
  })

  it('accepts a typical username', () => {
    expect(validateUsername('Jane Doe')).toBe(true)
  })
})

// ─── validateExperienceNote ───────────────────────────────────────────────────

describe('validateExperienceNote', () => {
  it('accepts a single character (length 1)', () => {
    expect(validateExperienceNote('x')).toBe(true)
  })

  it('accepts a 500-character note (upper bound)', () => {
    expect(validateExperienceNote('a'.repeat(500))).toBe(true)
  })

  it('rejects an empty string (length 0)', () => {
    expect(validateExperienceNote('')).toBe(false)
  })

  it('rejects a 501-character note (over limit)', () => {
    expect(validateExperienceNote('a'.repeat(501))).toBe(false)
  })
})

// ─── validateProfileImage ─────────────────────────────────────────────────────

describe('validateProfileImage', () => {
  const FIVE_MB = 5_242_880

  it.each(['image/jpeg', 'image/png', 'image/webp'])(
    'accepts %s at exactly 5 MB',
    (mimeType) => {
      expect(validateProfileImage({ mimeType, size: FIVE_MB })).toEqual({ valid: true })
    },
  )

  it('rejects an unsupported MIME type', () => {
    expect(validateProfileImage({ mimeType: 'image/gif', size: 1000 })).toEqual({
      valid: false,
      error: 'invalid_format',
    })
  })

  it('rejects a file exceeding 5 MB', () => {
    expect(validateProfileImage({ mimeType: 'image/jpeg', size: FIVE_MB + 1 })).toEqual({
      valid: false,
      error: 'file_too_large',
    })
  })

  it('reports invalid_format before file_too_large when both conditions fail', () => {
    expect(validateProfileImage({ mimeType: 'application/pdf', size: FIVE_MB + 1 })).toEqual({
      valid: false,
      error: 'invalid_format',
    })
  })

  it('accepts a small valid file', () => {
    expect(validateProfileImage({ mimeType: 'image/png', size: 1024 })).toEqual({ valid: true })
  })
})

// ─── validateEmail ────────────────────────────────────────────────────────────

describe('validateEmail', () => {
  it.each([
    'user@example.com',
    'first.last@domain.co.uk',
    'user+tag@sub.domain.org',
    'a@b.io',
  ])('accepts valid email: %s', (email) => {
    expect(validateEmail(email)).toBe(true)
  })

  it.each([
    '',
    'notanemail',
    '@nodomain.com',
    'noatsign.com',
    'user@',
    'user@nodot',
    'user @example.com',
  ])('rejects invalid email: %s', (email) => {
    expect(validateEmail(email)).toBe(false)
  })
})

// ─── validateTripDates ────────────────────────────────────────────────────────

describe('validateTripDates', () => {
  const today = new Date()

  function daysFromToday(n: number): Date {
    const d = new Date(today)
    d.setDate(d.getDate() + n)
    return d
  }

  it('accepts start = today, end = today + 7', () => {
    expect(validateTripDates(daysFromToday(0), daysFromToday(7))).toEqual({ valid: true })
  })

  it('accepts start = tomorrow, end = next week', () => {
    expect(validateTripDates(daysFromToday(1), daysFromToday(7))).toEqual({ valid: true })
  })

  it('rejects start date in the past', () => {
    expect(validateTripDates(daysFromToday(-1), daysFromToday(7))).toEqual({
      valid: false,
      error: 'start_date_in_past',
    })
  })

  it('rejects end date before start date', () => {
    expect(validateTripDates(daysFromToday(5), daysFromToday(3))).toEqual({
      valid: false,
      error: 'end_before_start',
    })
  })

  it('returns start_date_in_past when both conditions are true', () => {
    // start in past, end before start
    expect(validateTripDates(daysFromToday(-5), daysFromToday(-10))).toEqual({
      valid: false,
      error: 'start_date_in_past',
    })
  })

  it('ignores the time component — start at end-of-day today is still valid', () => {
    const startEndOfDay = new Date(today)
    startEndOfDay.setHours(23, 59, 59, 999)
    const end = daysFromToday(3)
    expect(validateTripDates(startEndOfDay, end)).toEqual({ valid: true })
  })
})

// ─── normaliseCacheKey ────────────────────────────────────────────────────────

describe('normaliseCacheKey', () => {
  const base: CacheKey = {
    destination: 'Costa Rica',
    month: 'January',
    travellerType: 'Solo',
    budgetRange: 'mid',
  }

  it('lowercases destination and trims whitespace', () => {
    const result = normaliseCacheKey({ ...base, destination: '  Costa Rica  ' })
    expect(result.destination).toBe('costa rica')
  })

  it('lowercases month and trims whitespace', () => {
    const result = normaliseCacheKey({ ...base, month: '  JANUARY  ' })
    expect(result.month).toBe('january')
  })

  it('lowercases travellerType and trims whitespace', () => {
    const result = normaliseCacheKey({ ...base, travellerType: 'Solo' })
    expect(result.travellerType).toBe('solo')
  })

  it('leaves budgetRange unchanged', () => {
    const result = normaliseCacheKey({ ...base, budgetRange: 'luxury' })
    expect(result.budgetRange).toBe('luxury')
  })

  it('produces equal keys for different-case variants of the same destination', () => {
    const a = normaliseCacheKey({ ...base, destination: 'MALLORCA' })
    const b = normaliseCacheKey({ ...base, destination: 'mallorca' })
    expect(a.destination).toBe(b.destination)
  })
})

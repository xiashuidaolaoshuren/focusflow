import { describe, expect, it } from 'vitest'

import { getLocalMinuteString } from '@/lib/planningDate'

describe('getLocalMinuteString', () => {
  it('zeroes the seconds of a local date', () => {
    expect(getLocalMinuteString(new Date(2026, 10, 15, 4, 24, 5))).toBe(
      '04:24:00',
    )
  })

  it('aligns a clock string that carries seconds', () => {
    expect(getLocalMinuteString('04:24:05')).toBe('04:24:00')
  })

  it('returns a minute-aligned current time when no argument is given', () => {
    expect(getLocalMinuteString()).toMatch(/^\d{2}:\d{2}:00$/)
  })
})

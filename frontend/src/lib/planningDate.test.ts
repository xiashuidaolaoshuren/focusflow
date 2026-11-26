import { describe, expect, it } from 'vitest'

import {
  getLocalMinuteString,
  isPastPlanningDate,
  nextPlanningDate,
  toClockMinutes,
} from '@/lib/planningDate'

describe('planning date steps', () => {
  it('moves one day forward, rolling over month ends', () => {
    expect(nextPlanningDate('2026-11-14')).toBe('2026-11-15')
    expect(nextPlanningDate('2026-11-30')).toBe('2026-12-01')
  })

  it('says whether a planned day is before today', () => {
    expect(isPastPlanningDate('2026-11-14', '2026-11-15')).toBe(true)
    expect(isPastPlanningDate('2026-11-15', '2026-11-15')).toBe(false)
    expect(isPastPlanningDate('2026-11-16', '2026-11-15')).toBe(false)
  })
})

describe('toClockMinutes', () => {
  it('reads an API clock and drops its seconds', () => {
    expect(toClockMinutes('09:05:30')).toBe(545)
    expect(toClockMinutes('00:00')).toBe(0)
  })

  it('treats a missing component as zero', () => {
    expect(toClockMinutes('9')).toBe(540)
  })
})

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

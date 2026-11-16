import { describe, expect, it } from 'vitest'

import { parseTimeInput, stepTime } from '@/components/form/timeInput'

describe('stepTime', () => {
  it('moves by 5 minutes, or 60 with Shift', () => {
    expect(stepTime('10:00', 1, false)).toBe('10:05')
    expect(stepTime('10:00', 1, true)).toBe('11:00')
    expect(stepTime('10:00', -1, false)).toBe('09:55')
  })

  it('clamps to 00:00 and 23:55', () => {
    expect(stepTime('23:55', 1, false)).toBe('23:55')
    expect(stepTime('23:30', 1, true)).toBe('23:55')
    expect(stepTime('00:00', -1, false)).toBe('00:00')
  })

  it('starts from 09:00 when the draft is not a valid time', () => {
    expect(stepTime('nope', 1, false)).toBe('09:05')
  })
})

describe('parseTimeInput', () => {
  it('normalizes compact and padded times', () => {
    expect(parseTimeInput('1745')).toBe('17:45')
    expect(parseTimeInput('9:05')).toBe('09:05')
    expect(parseTimeInput('905')).toBe('09:05')
    expect(parseTimeInput('17:45')).toBe('17:45')
  })

  it('rejects invalid times', () => {
    expect(parseTimeInput('25:00')).toBeNull()
    expect(parseTimeInput('12:60')).toBeNull()
    expect(parseTimeInput('abc')).toBeNull()
    expect(parseTimeInput('')).toBeNull()
  })
})

import { describe, expect, it } from 'vitest'

import { parseTimeInput } from '@/components/form/timeInput'

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

import { describe, expect, it } from 'vitest'

import { formatClock, formatDateLabel, formatDuration, relativeDueLabel } from '@/lib/format'

describe('relativeDueLabel', () => {
  it('says Today and Tomorrow for the next two days and a date otherwise', () => {
    expect(relativeDueLabel('2026-11-16', '2026-11-16')).toBe('Today')
    expect(relativeDueLabel('2026-11-17', '2026-11-16')).toBe('Tomorrow')
    expect(relativeDueLabel('2026-11-30', '2026-11-16')).toBe(formatDateLabel('2026-11-30'))
  })

  it('rolls Tomorrow over a month end', () => {
    expect(relativeDueLabel('2026-12-01', '2026-11-30')).toBe('Tomorrow')
  })
})

describe('formatDuration', () => {
  it('formats minutes without zero-padding the remainder', () => {
    expect(formatDuration(304)).toBe('5h 4m')
    expect(formatDuration(120)).toBe('2h')
    expect(formatDuration(50)).toBe('50m')
    expect(formatDuration(0)).toBe('0m')
  })
})

describe('formatClock', () => {
  it('trims seconds and pads single-digit hours', () => {
    expect(formatClock('09:00:00')).toBe('09:00')
    expect(formatClock('9:05')).toBe('09:05')
    expect(formatClock('09:00')).toBe('09:00')
  })
})

describe('formatDateLabel', () => {
  it('formats ISO dates in English without locale APIs', () => {
    expect(formatDateLabel('2026-11-06')).toBe('6 Nov 2026')
    expect(formatDateLabel('2026-02-30')).toBe('')
    expect(formatDateLabel('')).toBe('')
  })

  it('uses fixed English month names for every month', () => {
    expect(formatDateLabel('2026-01-01')).toBe('1 Jan 2026')
    expect(formatDateLabel('2026-12-25')).toBe('25 Dec 2026')
  })
})

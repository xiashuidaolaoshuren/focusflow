import { describe, expect, it } from 'vitest'

import {
  MONTH_NAMES,
  WEEKDAY_SHORT,
  addDays,
  addMonths,
  buildMonthGrid,
  isValidIsoDate,
} from '@/components/form/calendarMath'

describe('isValidIsoDate', () => {
  it('rejects invalid calendar dates', () => {
    expect(isValidIsoDate('2026-02-30')).toBe(false)
    expect(isValidIsoDate('2028-02-29')).toBe(true)
  })
})

describe('buildMonthGrid', () => {
  it('returns a Monday-first 42-cell grid', () => {
    const grid = buildMonthGrid(2026, 10)
    expect(grid).toHaveLength(42)
    expect(grid[0]!.iso).toBe('2026-10-26')
    expect(grid[0]!.inMonth).toBe(false)
    expect(grid[6]!.iso).toBe('2026-11-01')
    expect(grid[6]!.inMonth).toBe(true)
  })
})

describe('addDays and addMonths', () => {
  it('adds days across month boundaries', () => {
    expect(addDays('2026-11-06', 1)).toBe('2026-11-07')
    expect(addMonths('2026-11-06', 1)).toBe('2026-12-06')
  })
})

describe('English names', () => {
  it('exposes fixed month and weekday labels', () => {
    expect(MONTH_NAMES[10]).toBe('November')
    expect(WEEKDAY_SHORT[0]).toBe('Mon')
  })
})

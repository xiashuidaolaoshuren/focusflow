import { describe, expect, it } from 'vitest'

import type { HorizonDayResponse, HorizonSegmentResponse } from '@/types/api'

import {
  barPercent,
  deadlineBadgeLabel,
  formatDueDateTitle,
  isDueDateColumn,
  longestFullWorkWindow,
  segmentAriaLabel,
  segmentCellCopy,
  timeSpanMinutes,
} from '@/features/horizon/horizonGrid'

describe('longestFullWorkWindow', () => {
  const savedDays: HorizonDayResponse[] = [
    {
      date: '2026-06-01',
      kind: 'SAVED',
      planId: 10,
      needsRefresh: false,
      dependenciesIgnored: [],
    },
    {
      date: '2026-06-02',
      kind: 'FORECAST',
      planId: null,
      needsRefresh: null,
      dependenciesIgnored: [],
    },
  ]

  it('uses the max of forecast window and saved plan captured windows', () => {
    expect(
      longestFullWorkWindow(
        540,
        [{ planId: 10, windowMinutes: 600 }],
        savedDays,
      ),
    ).toBe(600)
  })

  it('barPercent maps minutes to scale percentage', () => {
    expect(barPercent(60, 600)).toBe(10)
  })
})

describe('segmentCellCopy', () => {
  it('labels unplaced reasons and saved shortfall', () => {
    const segment: HorizonSegmentResponse = {
      date: '2026-06-01',
      minutes: 0,
      assumedCreditMinutes: null,
      creditExclusions: [],
      unplacedReason: 'BLOCKED',
      unplacedMinutes: null,
      unplacedScope: null,
    }
    expect(segmentCellCopy(segment)).toContain('Blocked')

    const shortfall: HorizonSegmentResponse = {
      ...segment,
      unplacedReason: 'OUT_OF_TIME',
      unplacedMinutes: 30,
      unplacedScope: 'SAVED_SHORTFALL',
    }
    expect(segmentCellCopy(shortfall)).toContain('Saved shortfall: 30 min')
  })

  it('states credit when it differs from displayed minutes', () => {
    const segment: HorizonSegmentResponse = {
      date: '2026-06-01',
      minutes: 60,
      assumedCreditMinutes: 30,
      creditExclusions: ['CHECKPOINT'],
      unplacedReason: null,
      unplacedMinutes: null,
      unplacedScope: null,
    }
    expect(segmentCellCopy(segment)).toEqual([
      '60 min',
      '30 min credited of 60 min displayed (checkpoint)',
    ])
  })
})

describe('segmentAriaLabel', () => {
  it('includes title, date, minutes, and day kind', () => {
    const segment: HorizonSegmentResponse = {
      date: '2026-06-02',
      minutes: 45,
      assumedCreditMinutes: null,
      creditExclusions: [],
      unplacedReason: null,
      unplacedMinutes: null,
      unplacedScope: null,
    }
    expect(
      segmentAriaLabel({ title: 'Write report' }, segment, 'FORECAST'),
    ).toContain('Write report')
    expect(
      segmentAriaLabel({ title: 'Write report' }, segment, 'FORECAST'),
    ).toContain('forecast day')
  })
})

describe('due date helpers', () => {
  it('shows actual due date in title and marker only on column dates', () => {
    expect(formatDueDateTitle('2026-06-08')).toBe('2026-06-08')
    expect(isDueDateColumn('2026-06-08', ['2026-06-01', '2026-06-08'])).toBe(
      true,
    )
    expect(isDueDateColumn('2026-06-07', ['2026-06-01'])).toBe(false)
  })
})

describe('deadlineBadgeLabel', () => {
  it('maps status to badge copy and names unresolved effort', () => {
    expect(deadlineBadgeLabel('AT_RISK', [])).toBe('At risk')
    expect(deadlineBadgeLabel('OVERDUE', [])).toBe('Overdue')
    expect(
      deadlineBadgeLabel('CANNOT_FORECAST', [
        { taskId: 2, title: 'Blocker' },
      ]),
    ).toBe('Cannot forecast: Blocker')
    expect(deadlineBadgeLabel('ON_TRACK', [])).toBeNull()
    expect(deadlineBadgeLabel(null, [])).toBeNull()
  })
})

describe('timeSpanMinutes', () => {
  it('computes window length from clock strings', () => {
    expect(timeSpanMinutes('09:00:00', '18:00:00')).toBe(540)
  })
})

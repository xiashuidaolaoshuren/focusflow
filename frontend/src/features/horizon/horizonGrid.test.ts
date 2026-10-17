import { describe, expect, it } from 'vitest'

import type { HorizonDayResponse, HorizonSegmentResponse } from '@/types/api'

import {
  barPercent,
  dashboardHref,
  deadlineBadgeLabel,
  forecastHeaderCopy,
  formatDueDateTitle,
  HORIZON_PACE_COPY,
  isDueDateColumn,
  longestFullWorkWindow,
  savedConflictCopy,
  segmentAriaLabel,
  segmentCellCopy,
  timeSpanMinutes,
  upstreamCopy,
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

  it('states a fully excluded saved session as zero credited', () => {
    const segment: HorizonSegmentResponse = {
      date: '2026-06-01',
      minutes: 60,
      assumedCreditMinutes: 0,
      creditExclusions: ['CHECKPOINT'],
      unplacedReason: null,
      unplacedMinutes: null,
      unplacedScope: null,
    }
    expect(segmentCellCopy(segment)).toEqual([
      '60 min',
      '0 min credited of 60 min displayed (checkpoint)',
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

describe('horizon copy helpers', () => {
  const savedDay: HorizonDayResponse = {
    date: '2026-06-01',
    kind: 'SAVED',
    planId: 10,
    needsRefresh: false,
    dependenciesIgnored: [],
  }
  const forecastDay: HorizonDayResponse = {
    date: '2026-06-02',
    kind: 'FORECAST',
    planId: null,
    needsRefresh: null,
    dependenciesIgnored: [],
  }

  it('states the as-planned pace assumption in one sentence', () => {
    expect(HORIZON_PACE_COPY).toBe(
      'Eligible unrecorded sessions on saved plans are assumed completed as planned; a dependency conflict or an assessment that already covers the session is excluded, and recording skipped or partly done work updates the rest of the horizon.',
    )
  })

  it('explains a saved column that ignores a dependency', () => {
    expect(savedConflictCopy(savedDay)).toBeNull()
    expect(savedConflictCopy(forecastDay)).toBeNull()
    expect(savedConflictCopy({ ...savedDay, dependenciesIgnored: [7] })).toBe(
      'A saved session conflicts with a current dependency. Generating again applies the current rules, and this plan is left as saved.',
    )
  })

  it('names the fixed forecast order and links the matching dashboard date', () => {
    expect(forecastHeaderCopy()).toBe(
      'Fixed order: must-continue, then due or overdue, then optional. Generating a Daily plan for this date can choose a different order inside those groups.',
    )
    expect(dashboardHref('2026-06-02')).toBe('/dashboard?date=2026-06-02')
  })

  it('names the upstream cause when one exists', () => {
    expect(upstreamCopy({ upstreamBlockers: [] })).toBeNull()
    expect(
      upstreamCopy({
        upstreamBlockers: [
          { taskId: 1, title: 'Upstream' },
          { taskId: 2, title: 'Other' },
        ],
      }),
    ).toBe('Upstream cause: Upstream, Other')
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

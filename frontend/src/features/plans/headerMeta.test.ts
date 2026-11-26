import { describe, expect, it } from 'vitest'

import { headerMetaParts } from '@/features/plans/headerMeta'

const today = '2026-11-15'

describe('headerMetaParts', () => {
  it('lists the schedule and the re-plan time for a plan on today', () => {
    expect(
      headerMetaParts({
        hasPreferences: true,
        hasPlan: true,
        replayedAt: '04:24:00',
        planDate: today,
        today,
      }),
    ).toEqual(['schedule', 'replanned'])
  })

  it('does not list a re-plan that never happened, so no separator dangles', () => {
    expect(
      headerMetaParts({
        hasPreferences: true,
        hasPlan: true,
        replayedAt: null,
        planDate: today,
        today,
      }),
    ).toEqual(['schedule'])
  })

  it('names a missing plan and a past day without a leading separator', () => {
    expect(
      headerMetaParts({
        hasPreferences: false,
        hasPlan: false,
        replayedAt: null,
        planDate: '2026-11-14',
        today,
      }),
    ).toEqual(['noPlan', 'past'])
  })

  it('names an upcoming day after the schedule and the missing plan', () => {
    expect(
      headerMetaParts({
        hasPreferences: true,
        hasPlan: false,
        replayedAt: null,
        planDate: '2026-11-16',
        today,
      }),
    ).toEqual(['schedule', 'noPlan', 'upcoming'])
  })

  it('is empty for today when there is nothing to say', () => {
    expect(
      headerMetaParts({
        hasPreferences: false,
        hasPlan: true,
        replayedAt: null,
        planDate: today,
        today,
      }),
    ).toEqual([])
  })
})

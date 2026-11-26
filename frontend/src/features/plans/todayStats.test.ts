import { describe, expect, it } from 'vitest'

import { todayStats } from '@/features/plans/todayStats'
import { samplePlan, sampleWorkBlock } from '@/features/plans/planFixtures'
import type { DailyPlanResponse, WorkBlockResponse } from '@/types/api'

function work(
  id: number,
  start: string,
  end: string,
  overrides: Partial<WorkBlockResponse> = {},
): WorkBlockResponse {
  return { ...sampleWorkBlock, id, startTime: start, endTime: end, ...overrides }
}

const plannedDay: DailyPlanResponse = {
  ...samplePlan,
  planDate: '2026-11-06',
  composedRail: [
    work(1, '09:00:00', '09:50:00', {
      outcome: 'DONE',
      actualMinutes: 50,
    }),
    work(2, '10:00:00', '10:50:00', {
      outcome: 'PARTLY_DONE',
      actualMinutes: 20,
    }),
    work(3, '11:00:00', '11:30:00', { startTime: '11:00:00', endTime: '11:30:00' }),
    work(4, '12:00:00', '12:45:00'),
  ],
}

describe('todayStats', () => {
  it('totals planned, done, left and shortfall for a planned day', () => {
    const stats = todayStats(plannedDay, '2026-11-06', '2026-11-06', 8 * 60)

    expect(stats).toEqual({
      planned: 50 + 50 + 30 + 45,
      done: 50 + 20,
      left: 30 + 45,
      shortfall: 0,
    })
  })

  it('ignores sessions that are no longer needed', () => {
    const plan: DailyPlanResponse = {
      ...plannedDay,
      composedRail: [
        work(1, '09:00:00', '09:50:00', { outcome: 'DONE', actualMinutes: 50 }),
        work(2, '10:00:00', '10:50:00', { displayState: 'NO_LONGER_NEEDED' }),
        work(3, '11:00:00', '11:30:00', { outcome: 'SKIPPED' }),
      ],
    }

    expect(todayStats(plan, '2026-11-06', '2026-11-06', 9 * 60)).toEqual({
      planned: 50 + 30,
      done: 50,
      left: 0,
      shortfall: 0,
    })
  })

  it('counts only the remaining minutes when the plan is today', () => {
    const stats = todayStats(plannedDay, '2026-11-06', '2026-11-06', 11 * 60 + 15)

    expect(stats?.left).toBe(15 + 45)
  })

  it('counts a whole future session and no past session', () => {
    expect(todayStats(plannedDay, '2026-11-07', '2026-11-06', 11 * 60)?.left).toBe(30 + 45)
    expect(todayStats(plannedDay, '2026-11-05', '2026-11-06', 11 * 60)?.left).toBe(0)
  })

  it('has no figures without a plan', () => {
    expect(todayStats(null, '2026-11-06', '2026-11-06', 11 * 60)).toBeNull()
  })

  it('reports the shortfall the plan health rows explain', () => {
    const plan: DailyPlanResponse = {
      ...plannedDay,
      unplacedWork: [
        {
          reason: 'OUT_OF_TIME',
          unplacedMinutes: 30,
          blockerSourceTaskIds: [],
          taskSnapshot: { ...sampleWorkBlock.taskSnapshot, title: 'Overflow' },
        },
      ],
    }

    expect(todayStats(plan, '2026-11-06', '2026-11-06', 8 * 60)?.shortfall).toBe(30)
  })
})

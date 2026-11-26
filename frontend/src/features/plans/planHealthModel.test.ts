import { describe, expect, it } from 'vitest'

import { planHealth } from '@/features/plans/planHealthModel'
import {
  samplePlan,
  sampleTaskSnapshot,
  sampleWorkBlock,
} from '@/features/plans/planFixtures'
import type {
  DailyPlanResponse,
  UnplacedWorkResponse,
  WorkBlockResponse,
} from '@/types/api'

function unplaced(
  reason: UnplacedWorkResponse['reason'],
  title: string,
  unplacedMinutes: number | null,
  blockerSourceTaskIds: number[] = [],
): UnplacedWorkResponse {
  return {
    reason,
    unplacedMinutes,
    taskSnapshot: { ...sampleTaskSnapshot, sourceTaskId: 77, title },
    blockerSourceTaskIds,
  }
}

function block(title: string, start: string, end: string): WorkBlockResponse {
  return {
    ...sampleWorkBlock,
    id: 900 + start.length,
    startTime: start,
    endTime: end,
    taskSnapshot: { ...sampleTaskSnapshot, sourceTaskId: 77, title },
  }
}

function planWith(
  unplacedWork: UnplacedWorkResponse[],
  composedRail: WorkBlockResponse[] = [],
): DailyPlanResponse {
  return { ...samplePlan, unplacedWork, composedRail }
}

describe('planHealth', () => {
  it('measures the shortfall from the work that did not fit', () => {
    const health = planHealth(
      planWith(
        [unplaced('OUT_OF_TIME', 'Prepare slides', 10)],
        [block('Prepare slides', '09:00:00', '10:20:00')],
      ),
    )

    expect(health.shortfall).toEqual({
      minutes: 10,
      rows: [{ title: 'Prepare slides', placed: 80, total: 90 }],
    })
  })

  it('reports no shortfall when everything fits', () => {
    expect(planHealth(planWith([])).shortfall).toBeNull()
  })

  it('separates blocked work from work without an estimate', () => {
    const health = planHealth(
      planWith([
        unplaced('BLOCKED', 'Review PR', null, [12, 13]),
        unplaced('NO_ESTIMATE', 'Draft memo', null),
        unplaced('OUT_OF_TIME', 'Prepare slides', 10),
      ]),
    )

    expect(health.blocked).toEqual([
      { title: 'Review PR', waitingOn: [12, 13] },
    ])
    expect(health.unplaced).toEqual([{ title: 'Draft memo' }])
  })

  it('reports empty lists when the plan is healthy', () => {
    const health = planHealth(planWith([]))

    expect(health.blocked).toEqual([])
    expect(health.unplaced).toEqual([])
  })
})

import { describe, expect, it } from 'vitest'

import { actionVisibility, buildReplanRequest } from '@/features/plans/planActionRules'
import { progressPlan, samplePlan, sampleWorkBlock } from '@/features/plans/planFixtures'
import type { TaskResponse } from '@/types/api'

const TODAY = '2026-06-15'

function task(
  id: number,
  status: TaskResponse['status'],
  effortVersion: number,
): TaskResponse {
  return {
    id,
    title: `Task ${id}`,
    description: null,
    priority: 'MEDIUM',
    status,
    dueDate: null,
    estimatedMinutes: null,
    remainingEffortMinutes: 30,
    effortVersion,
    blockedBy: [],
    blocks: [],
  }
}

describe('actionVisibility', () => {
  it('offers only Generate when there is no plan', () => {
    expect(actionVisibility(null, TODAY, TODAY)).toEqual({
      generate: true,
      regenerate: false,
      replan: false,
    })
    expect(actionVisibility(null, '2026-06-01', TODAY).generate).toBe(true)
  })

  it('offers Regenerate and Re-plan on today when nothing is recorded', () => {
    expect(actionVisibility(samplePlan, TODAY, TODAY)).toEqual({
      generate: false,
      regenerate: true,
      replan: true,
    })
  })

  it('hides Regenerate once any revision has an outcome', () => {
    expect(actionVisibility(progressPlan, TODAY, TODAY)).toEqual({
      generate: false,
      regenerate: false,
      replan: true,
    })
  })

  it('offers nothing on a past date', () => {
    expect(actionVisibility(samplePlan, '2026-06-14', TODAY)).toEqual({
      generate: false,
      regenerate: false,
      replan: false,
    })
    expect(actionVisibility(progressPlan, '2026-06-14', TODAY)).toEqual({
      generate: false,
      regenerate: false,
      replan: false,
    })
  })

  it('offers Regenerate but never Re-plan on a future date', () => {
    expect(actionVisibility(samplePlan, '2026-06-16', TODAY)).toEqual({
      generate: false,
      regenerate: true,
      replan: false,
    })
  })

  it('offers nothing on a future date that somehow has an outcome', () => {
    expect(actionVisibility(progressPlan, '2026-06-16', TODAY)).toEqual({
      generate: false,
      regenerate: false,
      replan: false,
    })
  })
})

describe('buildReplanRequest', () => {
  it('names the latest revision, the cutoff and the plannable effort versions', () => {
    const now = new Date(2026, 5, 15, 14, 10, 42)

    const request = buildReplanRequest(
      {
        ...samplePlan,
        revisions: [
          { ...samplePlan.revisions[0]!, id: 5, revisionNumber: 1 },
          {
            ...samplePlan.revisions[0]!,
            id: 9,
            revisionNumber: 2,
            blocks: [sampleWorkBlock],
          },
        ],
      },
      [
        task(1, 'OPEN', 3),
        task(2, 'IN_PROGRESS', 7),
        task(3, 'DONE', 4),
        task(4, 'CANCELLED', 2),
      ],
      now,
    )

    expect(request).toEqual({
      currentDate: '2026-06-15',
      cutoff: '14:10:00',
      expectedRevisionId: 9,
      effortVersions: [
        { taskId: 1, effortVersion: 3 },
        { taskId: 2, effortVersion: 7 },
      ],
    })
  })

  it('returns null when the plan has no revision to replace', () => {
    expect(
      buildReplanRequest({ ...samplePlan, revisions: [] }, [], new Date(2026, 5, 15)),
    ).toBeNull()
  })
})

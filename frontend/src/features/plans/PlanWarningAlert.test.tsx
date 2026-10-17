import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { PlanWarningAlert } from '@/features/plans/PlanWarningAlert'
import { indexSnapshotTitles } from '@/features/plans/planSnapshotCopy'
import { samplePlan, sampleWorkBlock } from '@/features/plans/planFixtures'
import type { DailyPlanResponse, DailyPlanWarning } from '@/types/api'

function renderAlert(warning: DailyPlanWarning, plan: DailyPlanResponse = samplePlan) {
  return render(
    <PlanWarningAlert
      warning={warning}
      snapshotTitles={indexSnapshotTitles(plan)}
    />,
  )
}

describe('PlanWarningAlert blocked tasks', () => {
  it('lists blocked work with waiting-on copy separate from out-of-time minutes', () => {
    const plan: DailyPlanResponse = {
      ...samplePlan,
      blocks: [
        sampleWorkBlock,
        {
          ...sampleWorkBlock,
          id: 101,
          taskSnapshot: {
            ...sampleWorkBlock.taskSnapshot,
            sourceTaskId: 11,
            title: 'Blocker task',
          },
        },
      ],
    }

    renderAlert(
      {
        requiredMinutes: 120,
        freeMinutes: 480,
        scheduledWorkMinutes: 60,
        outOfTimeTasks: [
          { sourceTaskId: 12, title: 'Overflow', unplacedMinutes: 30 },
        ],
        unestimatedTasks: [],
        blockedTasks: [
          {
            sourceTaskId: 20,
            title: 'Must-include blocked',
            blockerSourceTaskIds: [10, 11],
          },
        ],
      },
      plan,
    )

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent(/overflow — 30 min unplaced/i)
    expect(alert).toHaveTextContent(
      /must-include blocked: waiting on write tests, blocker task/i,
    )
    expect(alert).not.toHaveTextContent(/480 min were free.*blocked/i)
  })

  it('uses a blocked-only lead sentence without implying the day ran out of time', () => {
    renderAlert({
      requiredMinutes: 60,
      freeMinutes: 480,
      scheduledWorkMinutes: 0,
      outOfTimeTasks: [],
      unestimatedTasks: [],
      blockedTasks: [
        {
          sourceTaskId: 20,
          title: 'Waiting task',
          blockerSourceTaskIds: [10],
        },
      ],
    })

    expect(
      screen.getByText(/waiting on other work before they can be scheduled/i),
    ).toBeInTheDocument()
    expect(screen.queryByText(/only 480 min were free/i)).not.toBeInTheDocument()
  })
})

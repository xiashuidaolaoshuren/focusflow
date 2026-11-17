import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { samplePlan, unplacedPlan } from '@/features/plans/planFixtures'

vi.mock('@/features/tasks/hooks', () => ({
  useTasks: vi.fn(() => ({ tasks: [] })),
}))

vi.mock('@/features/plans/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/plans/hooks')>()
  return {
    ...actual,
    useDeleteUnplannedWork: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
    useCreateUnplannedWork: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  }
})

import { PlanSideCards } from '@/features/plans/PlanSideCards'

describe('PlanSideCards blocked work', () => {
  it('names the blocker from the plan snapshot', () => {
    const blockerEntry = unplacedPlan.unplacedWork[0]!
    const plan = {
      ...samplePlan,
      unplacedWork: [
        {
          reason: 'BLOCKED' as const,
          unplacedMinutes: 60,
          blockerSourceTaskIds: [1],
          taskSnapshot: { ...blockerEntry.taskSnapshot, sourceTaskId: 2, title: 'Task B' },
        },
        {
          reason: 'NO_ESTIMATE' as const,
          unplacedMinutes: null,
          blockerSourceTaskIds: [],
          taskSnapshot: { ...blockerEntry.taskSnapshot, sourceTaskId: 1, title: 'Task A' },
        },
      ],
    }

    render(<PlanSideCards plan={plan} />)

    expect(screen.getByText('Waiting on Task A')).toBeInTheDocument()
    expect(screen.queryByText('Waiting on another task')).not.toBeInTheDocument()
  })
})

describe('PlanSideCards unplanned work', () => {
  it('opens the Log unplanned work dialog from the Unplanned work card', () => {
    render(<PlanSideCards plan={samplePlan} />)

    fireEvent.click(screen.getByRole('button', { name: 'Log unplanned work' }))

    expect(
      screen.getByRole('alertdialog', { name: 'Log unplanned work' }),
    ).toBeInTheDocument()
  })
})

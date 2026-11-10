import { renderHook } from '@testing-library/react'
import { act } from 'react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/features/plans/hooks', () => ({
  useReplan: vi.fn(),
}))

vi.mock('@/features/tasks/hooks', () => ({
  useTasks: vi.fn(),
}))

import { samplePlan } from '@/features/plans/planFixtures'
import { useReplan } from '@/features/plans/hooks'
import { useReplanPlan } from '@/features/plans/useReplanPlan'
import { useTasks } from '@/features/tasks/hooks'

const mockedUseReplan = vi.mocked(useReplan)
const mockedUseTasks = vi.mocked(useTasks)

function mockReplan(state: {
  mutate?: ReturnType<typeof vi.fn>
  isPending?: boolean
  error?: Error | null
}) {
  mockedUseReplan.mockReturnValue({
    mutate: state.mutate ?? vi.fn(),
    isPending: state.isPending ?? false,
    error: state.error ?? null,
  } as unknown as ReturnType<typeof useReplan>)
}

function mockTasks() {
  mockedUseTasks.mockReturnValue({
    tasks: [
      {
        id: 4,
        title: 'Ship it',
        description: null,
        priority: 'HIGH',
        status: 'OPEN',
        dueDate: null,
        estimatedMinutes: 30,
        remainingEffortMinutes: 30,
        effortVersion: 2,
        blockedBy: [],
        blocks: [],
      },
    ],
  } as unknown as ReturnType<typeof useTasks>)
}

describe('useReplanPlan', () => {
  it('sends the re-plan request for the plan', () => {
    const mutate = vi.fn()
    mockReplan({ mutate })
    mockTasks()

    const { result } = renderHook(() =>
      useReplanPlan(samplePlan, new Date(2026, 5, 15, 14, 10, 42)),
    )

    act(() => result.current.run())

    expect(mutate).toHaveBeenCalledWith({
      id: samplePlan.id,
      request: {
        currentDate: '2026-06-15',
        cutoff: '14:10:42',
        expectedRevisionId: samplePlan.revisions[0]!.id,
        effortVersions: [{ taskId: 4, effortVersion: 2 }],
      },
    })
  })

  it('exposes the pending and error state of the mutation', () => {
    const error = new Error('REPLAN_WINDOW_ENDED')
    mockReplan({ isPending: true, error })
    mockTasks()

    const { result } = renderHook(() => useReplanPlan(samplePlan))

    expect(result.current.isPending).toBe(true)
    expect(result.current.error).toBe(error)
  })

  it('does nothing without a plan or a revision', () => {
    const mutate = vi.fn()
    mockReplan({ mutate })
    mockTasks()

    const withoutPlan = renderHook(() => useReplanPlan(null))
    act(() => withoutPlan.result.current.run())

    const withoutRevision = renderHook(() =>
      useReplanPlan({ ...samplePlan, revisions: [] }),
    )
    act(() => withoutRevision.result.current.run())

    expect(mutate).not.toHaveBeenCalled()
  })
})

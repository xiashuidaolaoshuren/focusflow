import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { DailyPlanView } from '@/features/plans/DailyPlanView'
import {
  progressPlan,
  reducedBufferPlan,
  samplePlan,
  sampleRevision,
  sampleWorkBlock,
  unplacedPlan,
  warningPlan,
} from '@/features/plans/planFixtures'
import type { DailyPlanResponse, TaskResponse } from '@/types/api'

describe('DailyPlanView stale notice', () => {
  it('shows a refresh notice when the plan needs refresh', () => {
    render(<DailyPlanView plan={progressPlan} />)

    expect(screen.getByText(/needs refresh/i)).toBeInTheDocument()
  })

  it('hides the notice when the plan still matches the live tasks', () => {
    render(<DailyPlanView plan={samplePlan} />)

    expect(screen.queryByText(/needs refresh/i)).not.toBeInTheDocument()
  })
})

describe('DailyPlanView recorded work', () => {
  it('lists known actuals, the missing-actual count, off-rail completions, and unplanned work', () => {
    render(<DailyPlanView plan={progressPlan} />)

    const section = screen.getByRole('region', { name: /recorded work/i })
    expect(within(section).getByText(/35 min recorded/i)).toBeInTheDocument()
    expect(
      within(section).getByText(/1 session missing actual minutes/i),
    ).toBeInTheDocument()

    const offRail = within(section).getByRole('list', {
      name: /off-rail early completions/i,
    })
    expect(within(offRail).getByText(/write tests/i)).toBeInTheDocument()

    const unplanned = within(section).getByRole('list', {
      name: /unplanned work/i,
    })
    expect(within(unplanned).getByText(/2026-06-17/i)).toBeInTheDocument()
    expect(within(unplanned).getByText(/20 min/i)).toBeInTheDocument()
  })

  it('hides the recorded-work section when nothing was recorded', () => {
    render(<DailyPlanView plan={samplePlan} />)

    expect(
      screen.queryByRole('region', { name: /recorded work/i }),
    ).not.toBeInTheDocument()
  })
})

describe('DailyPlanView composed rail', () => {
  it('renders the composed rail rather than the latest revision blocks', () => {
    const composedOnlyPlan = {
      ...samplePlan,
      blocks: [],
      composedRail: [
        {
          kind: 'COMMITMENT',
          startTime: '08:30:00',
          endTime: '08:45:00',
          sessionIndex: null,
          sessionCount: null,
          taskSnapshot: null,
          label: 'Standup',
          id: 300,
          revisionId: 1,
          outcome: null,
          actualMinutes: null,
          reconciled: false,
          progressVersion: 0,
          displayState: 'ACTIONABLE',
        },
      ],
    } as DailyPlanResponse

    render(<DailyPlanView plan={composedOnlyPlan} />)

    expect(
      screen.getByLabelText(/commitment: standup, 08:30–08:45/i),
    ).toBeInTheDocument()
  })
})

vi.mock('@/features/plans/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/plans/hooks')>()
  return {
    ...actual,
    useRecordBlockProgress: vi.fn(() => ({
      mutate: vi.fn(),
      isPending: false,
    })),
    useCreateUnplannedWork: vi.fn(() => ({
      mutate: vi.fn(),
      isPending: false,
    })),
    useDeleteUnplannedWork: vi.fn(() => ({
      mutate: vi.fn(),
      isPending: false,
    })),
  }
})

import { useRecordBlockProgress, useDeleteUnplannedWork } from '@/features/plans/hooks'

const mockedUseRecordBlockProgress = vi.mocked(useRecordBlockProgress)
const mockedUseDeleteUnplannedWork = vi.mocked(useDeleteUnplannedWork)

vi.mock('@/features/tasks/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/tasks/hooks')>()
  return {
    ...actual,
    useTasks: vi.fn(() => ({
      tasks: [],
      isPending: false,
      isError: false,
    })),
  }
})

import { useTasks } from '@/features/tasks/hooks'

const mockedUseTasks = vi.mocked(useTasks)

const liveTask: TaskResponse = {
  id: 10,
  title: 'Write tests',
  description: null,
  priority: 'HIGH',
  status: 'IN_PROGRESS',
  dueDate: '2026-06-15',
  estimatedMinutes: 60,
  remainingEffortMinutes: 25,
  effortVersion: 2,
  blockedBy: [],
  blocks: [],
}

describe('DailyPlanView revision rail', () => {
  it('renders the selected revision blocks instead of the composed rail', () => {
    const revisionOnlyBlock = {
      ...sampleWorkBlock,
      id: 501,
      startTime: '16:00:00',
      endTime: '16:30:00',
      displayState: 'SUPERSEDED' as const,
    }
    const plan: DailyPlanResponse = {
      ...samplePlan,
      revisions: [{ ...sampleRevision, blocks: [revisionOnlyBlock] }],
    }

    render(<DailyPlanView plan={plan} selectedRevisionId={sampleRevision.id} />)

    expect(
      screen.getByLabelText(/work: write tests, session 1 of 1, 16:00–16:30/i),
    ).toBeInTheDocument()
    expect(
      screen.queryByLabelText(/09:00–09:45/i),
    ).not.toBeInTheDocument()
  })
})

describe('DailyPlanView unplanned work', () => {
  it('deletes an unplanned entry after confirmation', async () => {
    const mutate = vi.fn()
    mockedUseDeleteUnplannedWork.mockReturnValue({
      mutate,
      isPending: false,
    } as unknown as ReturnType<typeof useDeleteUnplannedWork>)
    mockedUseTasks.mockReturnValue({
      tasks: [liveTask],
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useTasks>)

    render(<DailyPlanView plan={progressPlan} />)

    const list = screen.getByRole('list', { name: /unplanned work/i })
    fireEvent.click(
      within(list).getByRole('button', { name: /delete unplanned work/i }),
    )

    expect(mutate).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /^delete entry$/i }))

    expect(mutate).toHaveBeenCalledWith({
      id: 900,
      effortVersion: 2,
    })
  })

  it('reveals the unplanned-work form on request', () => {
    mockedUseTasks.mockReturnValue({
      tasks: [],
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useTasks>)

    render(<DailyPlanView plan={samplePlan} />)

    expect(
      screen.queryByRole('button', { name: /log unplanned work/i }),
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /add unplanned work/i }))

    expect(
      screen.getByRole('button', { name: /log unplanned work/i }),
    ).toBeInTheDocument()
  })
})

describe('DailyPlanView outcome dialog', () => {
  it('uses the live task remainder rather than the captured snapshot value', () => {
    mockedUseTasks.mockReturnValue({
      tasks: [liveTask],
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useTasks>)

    render(<DailyPlanView plan={progressPlan} />)

    fireEvent.click(
      screen.getByRole('button', { name: /work: write tests, session 1 of 1/i }),
    )

    expect(screen.getByText(/25 min remaining/i)).toBeInTheDocument()
    expect(screen.queryByText(/45 min captured remaining/i)).not.toBeInTheDocument()
  })

  it('opens the outcome dialog when a recordable work block is clicked', () => {
    render(<DailyPlanView plan={progressPlan} />)

    fireEvent.click(
      screen.getByRole('button', { name: /work: write tests, session 1 of 1/i }),
    )

    expect(
      screen.getByRole('alertdialog', { name: /record outcome/i }),
    ).toBeInTheDocument()
  })

  it('closes the dialog and explains a conflict without overwriting the newer change', () => {
    let hookOptions: { onConflict?: () => void } | undefined
    mockedUseRecordBlockProgress.mockImplementation((options) => {
      hookOptions = options
      return {
        mutate: vi.fn(),
        isPending: false,
      } as unknown as ReturnType<typeof useRecordBlockProgress>
    })

    render(<DailyPlanView plan={progressPlan} />)

    fireEvent.click(
      screen.getByRole('button', { name: /work: write tests, session 1 of 1/i }),
    )
    expect(
      screen.getByRole('alertdialog', { name: /record outcome/i }),
    ).toBeInTheDocument()

    act(() => {
      hookOptions?.onConflict?.()
    })

    expect(
      screen.queryByRole('alertdialog', { name: /record outcome/i }),
    ).not.toBeInTheDocument()
    expect(screen.getByText(/newer update was kept/i)).toBeInTheDocument()
  })

  it('does not open the dialog for a no-longer-needed block', () => {
    const plan: DailyPlanResponse = {
      ...samplePlan,
      composedRail: [{ ...sampleWorkBlock, displayState: 'NO_LONGER_NEEDED' }],
    }
    render(<DailyPlanView plan={plan} />)

    expect(
      screen.queryByRole('button', { name: /work: write tests/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('alertdialog', { name: /record outcome/i }),
    ).not.toBeInTheDocument()
  })
})

describe('DailyPlanView shortfall alert', () => {
  it('lists must-include out-of-time and unestimated tasks in the warning alert', () => {
    render(<DailyPlanView plan={warningPlan} />)

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent(/plan needs more focus time/i)
    expect(alert).toHaveTextContent(/180 min of focus time/i)
    expect(alert).toHaveTextContent(/120 min were free/i)
    expect(alert).toHaveTextContent('Write tests — 60 min unplaced')
    expect(alert).toHaveTextContent('Tidy up — unknown duration')
  })

  it('renders no alert when the plan warning is null', () => {
    render(<DailyPlanView plan={samplePlan} />)

    expect(screen.getByText(/today's plan/i)).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('DailyPlanView unplaced companion list', () => {
  it('shows no-estimate and out-of-time copy for unplaced work', () => {
    render(<DailyPlanView plan={unplacedPlan} />)

    expect(
      screen.getByText(/no estimate — add one to put it on the clock/i),
    ).toBeInTheDocument()
    expect(screen.getByText(/out of time — 30 min unplaced/i)).toBeInTheDocument()
  })

  it('shows waiting-on snapshot titles for blocked unplaced work', () => {
    const blockedPlan: DailyPlanResponse = {
      ...samplePlan,
      unplacedWork: [
        {
          reason: 'BLOCKED',
          unplacedMinutes: 45,
          blockerSourceTaskIds: [10, 11],
          taskSnapshot: {
            ...sampleWorkBlock.taskSnapshot,
            sourceTaskId: 20,
            title: 'Blocked feature',
          },
        },
        {
          reason: 'BLOCKED',
          unplacedMinutes: 45,
          blockerSourceTaskIds: [99],
          taskSnapshot: {
            ...sampleWorkBlock.taskSnapshot,
            sourceTaskId: 21,
            title: 'Unknown blocker title',
          },
        },
      ],
      blocks: [
        sampleWorkBlock,
        {
          ...sampleWorkBlock,
          id: 101,
          taskSnapshot: {
            ...sampleWorkBlock.taskSnapshot,
            sourceTaskId: 11,
            title: 'Second blocker',
          },
        },
      ],
      composedRail: [
        sampleWorkBlock,
        {
          ...sampleWorkBlock,
          id: 101,
          taskSnapshot: {
            ...sampleWorkBlock.taskSnapshot,
            sourceTaskId: 11,
            title: 'Second blocker',
          },
        },
      ],
    }

    render(<DailyPlanView plan={blockedPlan} />)

    expect(
      screen.getByText(/blocked feature: waiting on write tests, second blocker/i),
    ).toBeInTheDocument()
  })

  it('shows needed-for copy with due date from plan snapshots', () => {
    const inheritedPlan: DailyPlanResponse = {
      ...samplePlan,
      composedRail: [
        {
          ...sampleWorkBlock,
          taskSnapshot: {
            ...sampleWorkBlock.taskSnapshot,
            sourceTaskId: 30,
            title: 'Inherited prep',
            neededForTaskId: 10,
          },
        },
      ],
      blocks: [
        {
          ...sampleWorkBlock,
          taskSnapshot: {
            ...sampleWorkBlock.taskSnapshot,
            sourceTaskId: 30,
            title: 'Inherited prep',
            neededForTaskId: 10,
          },
        },
      ],
    }

    render(<DailyPlanView plan={inheritedPlan} />)

    expect(
      screen.getByText(/needed for write tests \(due 2026-06-15\)/i),
    ).toBeInTheDocument()
  })
})

describe('DailyPlanView reduced buffer note', () => {
  it('shows a non-error note when realized buffer is smaller than requested', () => {
    render(<DailyPlanView plan={reducedBufferPlan} />)

    expect(
      screen.getByText(/fixed breaks or commitments reduced contingency/i),
    ).toBeInTheDocument()
    expect(screen.getByText(/5 of 15 requested buffer minutes/i)).toBeInTheDocument()
  })

  it('hides the reduced-buffer note when buffer was fully reserved', () => {
    render(<DailyPlanView plan={samplePlan} />)

    expect(
      screen.queryByText(/fixed breaks or commitments reduced contingency/i),
    ).not.toBeInTheDocument()
  })
})

describe('DailyPlanView states', () => {
  it('shows empty fallback when no plan is available', () => {
    render(<DailyPlanView plan={null} />)

    expect(screen.getByText(/no plan for today yet/i)).toBeInTheDocument()
  })

  it('shows a skeleton card while loading', () => {
    render(<DailyPlanView plan={null} isPending />)

    expect(screen.getByRole('status', { name: /loading plan/i })).toBeInTheDocument()
    expect(screen.queryByText(/no plan for today yet/i)).not.toBeInTheDocument()
  })

  it('renders error alert with retry when isError', () => {
    const onRetry = vi.fn()
    render(<DailyPlanView plan={null} isError onRetry={onRetry} />)

    expect(screen.getByRole('alert')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /retry/i }))
    expect(onRetry).toHaveBeenCalled()
  })
})

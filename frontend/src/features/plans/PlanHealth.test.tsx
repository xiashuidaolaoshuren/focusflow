import { render } from '@testing-library/react'
import { fireEvent, screen } from '@testing-library/dom'
import { describe, expect, it, vi } from 'vitest'

import { PlanHealth } from '@/features/plans/PlanHealth'
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
    id: 900,
    startTime: start,
    endTime: end,
    taskSnapshot: { ...sampleTaskSnapshot, sourceTaskId: 77, title },
  }
}

function planWith(
  unplacedWork: UnplacedWorkResponse[],
  composedRail: WorkBlockResponse[] = [],
): DailyPlanResponse {
  return { ...samplePlan, unplacedWork, composedRail, needsRefresh: false }
}

describe('PlanHealth', () => {
  it('renders nothing when there is no plan', () => {
    const { container } = render(<PlanHealth plan={null} />)

    expect(container).toBeEmptyDOMElement()
    expect(screen.queryByText(/blocked work/i)).toBeNull()
    expect(screen.queryByText(/unplaced work/i)).toBeNull()
  })

  it('shows the shortfall with the work that did not fit', () => {
    render(
      <PlanHealth
        plan={planWith(
          [unplaced('OUT_OF_TIME', 'Prepare slides', 10)],
          [block('Prepare slides', '09:00:00', '10:20:00')],
        )}
      />,
    )

    expect(screen.getByText(/shortfall/i).parentElement).toHaveTextContent(
      'Shortfall · 10m',
    )
    expect(
      screen.getByText('Prepare slides · 80 of 90m placed'),
    ).toBeInTheDocument()
  })

  it('shows no shortfall when everything fits', () => {
    render(<PlanHealth plan={planWith([])} />)

    expect(screen.queryByText(/shortfall/i)).toBeNull()
  })

  it('offers Re-plan from the Needs refresh alert, not a paragraph', () => {
    const run = vi.fn()
    render(
      <PlanHealth
        plan={{ ...planWith([]), needsRefresh: true }}
        today={samplePlan.planDate}
        replan={{ run, isPending: false, error: null }}
      />,
    )

    expect(screen.getByText('Needs refresh')).toBeInTheDocument()
    const button = screen.getByRole('button', { name: /re-plan/i })
    fireEvent.click(button)
    expect(run).toHaveBeenCalledTimes(1)
    expect(run.mock.contexts.length).toBe(1)
  })

  it('does not offer Re-plan without a re-plan control or for a past day', () => {
    const { rerender } = render(
      <PlanHealth plan={{ ...planWith([]), needsRefresh: true }} />,
    )
    expect(screen.queryByRole('button', { name: /re-plan/i })).toBeNull()
    expect(screen.getByText('Needs refresh')).toBeInTheDocument()

    rerender(
      <PlanHealth
        plan={{ ...planWith([]), needsRefresh: true }}
        today="2026-06-16"
        replan={{ run: vi.fn(), isPending: false, error: null }}
      />,
    )
    expect(screen.queryByRole('button', { name: /re-plan/i })).toBeNull()
  })

  it('hides the Needs refresh alert when the plan is current', () => {
    render(<PlanHealth plan={planWith([])} today={samplePlan.planDate} />)

    expect(screen.queryByText('Needs refresh')).toBeNull()
  })

  it('lists blocked work with who it waits on, and work without an estimate', () => {
    render(
      <PlanHealth
        plan={planWith([
          unplaced('BLOCKED', 'Review PR', null, [12, 13]),
          unplaced('NO_ESTIMATE', 'Draft memo', null),
        ])}
      />,
    )

    const blocked = screen.getByText('Blocked work').closest('li')!
    expect(blocked).toHaveTextContent('Review PR · Waiting on Task 12, Task 13')
    expect(blocked).toHaveTextContent('1')

    const unplacedRow = screen.getByText('Unplaced work').closest('li')!
    expect(unplacedRow).toHaveTextContent('Draft memo · No estimate')
    expect(unplacedRow).toHaveTextContent('1')
  })

  it('shows None and zero for healthy rows', () => {
    render(<PlanHealth plan={planWith([])} />)

    expect(screen.getByText('Blocked work').closest('li')).toHaveTextContent(
      'None',
    )
    expect(screen.getByText('Unplaced work').closest('li')).toHaveTextContent(
      'None',
    )
    expect(screen.getByText('Blocked work').closest('li')).toHaveTextContent('0')
  })
})

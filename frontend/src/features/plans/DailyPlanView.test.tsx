import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { DailyPlanView } from '@/features/plans/DailyPlanView'
import {
  reducedBufferPlan,
  samplePlan,
  unplacedPlan,
  warningPlan,
} from '@/features/plans/planFixtures'

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

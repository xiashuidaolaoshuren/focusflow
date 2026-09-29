import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { DayTimeline } from '@/features/plans/DayTimeline'
import { samplePlan } from '@/features/plans/planFixtures'
import type { DailyPlanResponse } from '@/types/api'

const multiBlockPlan: DailyPlanResponse = {
  ...samplePlan,
  peakStart: null,
  peakEnd: null,
  blocks: [
    {
      kind: 'WORK',
      startTime: '09:00:00',
      endTime: '09:30:00',
      sessionIndex: 1,
      sessionCount: 2,
      taskSnapshot: samplePlan.blocks[0]!.taskSnapshot,
      label: null,
    },
    {
      kind: 'CADENCE_BREAK',
      startTime: '09:30:00',
      endTime: '09:40:00',
      sessionIndex: null,
      sessionCount: null,
      taskSnapshot: null,
      label: 'Stretch',
    },
    {
      kind: 'BUFFER',
      startTime: '17:45:00',
      endTime: '18:00:00',
      sessionIndex: null,
      sessionCount: null,
      taskSnapshot: null,
      label: 'Buffer',
    },
  ],
}

describe('DayTimeline', () => {
  it('exposes focusable blocks with kind, label, and time in the accessible name', () => {
    render(<DayTimeline plan={multiBlockPlan} />)

    expect(
      screen.getByRole('button', {
        name: /work: write tests, session 1 of 2, 09:00–09:30/i,
      }),
    ).toHaveAttribute('tabindex', '0')
    expect(
      screen.getByRole('button', {
        name: /cadence break: stretch, 09:30–09:40/i,
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', {
        name: /buffer: buffer, 17:45–18:00/i,
      }),
    ).toBeInTheDocument()
  })

  it('shows a peak hours region when the snapshot has a peak window', () => {
    render(<DayTimeline plan={samplePlan} />)

    expect(screen.getByRole('region', { name: /peak hours/i })).toBeInTheDocument()
  })

  it('omits the peak hours region when no peak window is present', () => {
    render(<DayTimeline plan={multiBlockPlan} />)

    expect(screen.queryByRole('region', { name: /peak hours/i })).not.toBeInTheDocument()
  })

  it('renders hour labels for the work window', () => {
    render(<DayTimeline plan={samplePlan} />)

    expect(screen.getByText('09:00')).toBeInTheDocument()
    expect(screen.getByText('18:00')).toBeInTheDocument()
  })
})

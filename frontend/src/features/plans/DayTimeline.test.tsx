import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { DayTimeline } from '@/features/plans/DayTimeline'
import { samplePlan, sampleWorkBlock } from '@/features/plans/planFixtures'
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
      taskSnapshot: sampleWorkBlock.taskSnapshot,
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
  const windowMinutes = 9 * 60
  const windowDuration = 9 * 60

  function percent(minutesFromWindowStart: number): string {
    return `${(minutesFromWindowStart / windowDuration) * 100}%`
  }

  it('positions blocks by clock time, not list order', () => {
    render(<DayTimeline plan={multiBlockPlan} />)

    const work = screen.getByRole('button', {
      name: /work: write tests, session 1 of 2, 09:00–09:30/i,
    })
    expect(work).toHaveStyle({ top: percent(0), height: percent(30) })

    const buffer = screen.getByRole('button', {
      name: /buffer: buffer, 17:45–18:00/i,
    })
    const bufferStartMinutes = 17 * 60 + 45 - windowMinutes
    expect(buffer).toHaveStyle({ top: percent(bufferStartMinutes), height: percent(15) })
  })

  it('styles each block kind distinctly and keeps the buffer an outlined empty slice', () => {
    render(<DayTimeline plan={multiBlockPlan} />)

    const work = screen.getByRole('button', {
      name: /work: write tests, session 1 of 2/i,
    })
    const buffer = screen.getByRole('button', {
      name: /buffer: buffer, 17:45–18:00/i,
    })
    const cadenceBreak = screen.getByRole('button', {
      name: /cadence break: stretch/i,
    })

    expect(work).toHaveAttribute('data-kind', 'WORK')
    expect(buffer).toHaveAttribute('data-kind', 'BUFFER')
    expect(cadenceBreak).toHaveAttribute('data-kind', 'CADENCE_BREAK')
    expect(work.className).not.toEqual(buffer.className)
    expect(buffer.className).toContain('border-dashed')
    expect(buffer.className).not.toContain('bg-primary')
  })

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

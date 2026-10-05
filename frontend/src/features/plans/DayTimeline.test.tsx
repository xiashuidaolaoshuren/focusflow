import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

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
      id: 101,
      revisionId: 1,
      outcome: null,
      actualMinutes: null,
      reconciled: false,
      progressVersion: 0,
      displayState: 'ACTIONABLE',
    },
    {
      kind: 'CADENCE_BREAK',
      startTime: '09:30:00',
      endTime: '09:40:00',
      sessionIndex: null,
      sessionCount: null,
      taskSnapshot: null,
      label: 'Stretch',
      id: 102,
      revisionId: 1,
      outcome: null,
      actualMinutes: null,
      reconciled: false,
      progressVersion: 0,
      displayState: 'ACTIONABLE',
    },
    {
      kind: 'BUFFER',
      startTime: '17:45:00',
      endTime: '18:00:00',
      sessionIndex: null,
      sessionCount: null,
      taskSnapshot: null,
      label: 'Buffer',
      id: 103,
      revisionId: 1,
      outcome: null,
      actualMinutes: null,
      reconciled: false,
      progressVersion: 0,
      displayState: 'ACTIONABLE',
    },
  ],
}

const annotatedPlan: DailyPlanResponse = {
  ...samplePlan,
  peakStart: null,
  peakEnd: null,
  blocks: [
    {
      ...sampleWorkBlock,
      id: 201,
      sessionIndex: 1,
      sessionCount: 5,
      outcome: 'DONE',
      actualMinutes: 35,
      progressVersion: 1,
    },
    {
      ...sampleWorkBlock,
      id: 202,
      startTime: '10:00:00',
      endTime: '10:30:00',
      sessionIndex: 2,
      sessionCount: 5,
      outcome: 'PARTLY_DONE',
      actualMinutes: 20,
      progressVersion: 1,
    },
    {
      ...sampleWorkBlock,
      id: 203,
      startTime: '11:00:00',
      endTime: '11:20:00',
      sessionIndex: 3,
      sessionCount: 5,
      outcome: 'SKIPPED',
      progressVersion: 1,
    },
    {
      ...sampleWorkBlock,
      id: 204,
      startTime: '12:00:00',
      endTime: '12:30:00',
      sessionIndex: 4,
      sessionCount: 5,
      displayState: 'NO_LONGER_NEEDED',
    },
    {
      ...sampleWorkBlock,
      id: 205,
      startTime: '13:00:00',
      endTime: '13:30:00',
      sessionIndex: 5,
      sessionCount: 5,
      outcome: 'PARTLY_DONE',
      actualMinutes: 15,
      reconciled: true,
      progressVersion: 2,
    },
  ],
}

describe('DayTimeline recordable blocks', () => {
  it('calls onBlockClick for actionable and historical work blocks', () => {
    const onBlockClick = vi.fn()
    const plan: DailyPlanResponse = {
      ...samplePlan,
      blocks: [
        {
          ...sampleWorkBlock,
          id: 401,
          sessionIndex: 1,
          sessionCount: 2,
          displayState: 'ACTIONABLE',
        },
        {
          ...sampleWorkBlock,
          id: 402,
          startTime: '10:00:00',
          endTime: '10:30:00',
          sessionIndex: 2,
          sessionCount: 2,
          displayState: 'HISTORICAL',
        },
      ],
    }
    render(<DayTimeline plan={plan} onBlockClick={onBlockClick} />)

    const actionable = screen.getByRole('button', {
      name: /work: write tests, session 1 of 2, 09:00–09:45/i,
    })
    const historical = screen.getByRole('button', {
      name: /work: write tests, session 2 of 2, 10:00–10:30/i,
    })
    fireEvent.click(actionable)
    fireEvent.click(historical)

    expect(onBlockClick).toHaveBeenCalledWith(expect.objectContaining({ id: 401 }))
    expect(onBlockClick).toHaveBeenCalledWith(expect.objectContaining({ id: 402 }))
  })

  it('leaves superseded and no-longer-needed blocks non-interactive', () => {
    const plan: DailyPlanResponse = {
      ...samplePlan,
      blocks: [
        {
          ...sampleWorkBlock,
          id: 403,
          sessionIndex: 1,
          sessionCount: 2,
          displayState: 'SUPERSEDED',
        },
        {
          ...sampleWorkBlock,
          id: 404,
          startTime: '10:00:00',
          endTime: '10:30:00',
          sessionIndex: 2,
          sessionCount: 2,
          displayState: 'NO_LONGER_NEEDED',
        },
      ],
    }
    render(<DayTimeline plan={plan} onBlockClick={vi.fn()} />)

    expect(screen.queryAllByRole('button')).toHaveLength(0)
    expect(
      screen.getByLabelText(/work: write tests, session 1 of 2/i),
    ).toBeInTheDocument()
  })
})

describe('DayTimeline recorded outcomes', () => {
  it('annotates work blocks with the recorded outcome', () => {
    render(<DayTimeline plan={annotatedPlan} />)

    expect(screen.getByText(/done · 35 min actual/i)).toBeInTheDocument()
    expect(screen.getByText(/partly done · 20 min actual/i)).toBeInTheDocument()
    expect(screen.getByText(/^skipped$/i)).toBeInTheDocument()
    expect(screen.getByText(/no longer needed/i)).toBeInTheDocument()
    expect(screen.getByText(/reconciled/i)).toBeInTheDocument()
  })

  it('names the recorded outcome in the accessible label', () => {
    render(<DayTimeline plan={annotatedPlan} />)

    expect(
      screen.getByLabelText(
        /work: write tests, session 1 of 5, 09:00–09:45 · done · 35 min actual/i,
      ),
    ).toBeInTheDocument()
  })

  it('leaves an unrecorded work block unannotated', () => {
    render(<DayTimeline plan={multiBlockPlan} />)

    expect(screen.queryByText(/min actual/i)).not.toBeInTheDocument()
  })
})

describe('DayTimeline', () => {
  const windowMinutes = 9 * 60
  const windowDuration = 9 * 60

  function percent(minutesFromWindowStart: number): string {
    return `${(minutesFromWindowStart / windowDuration) * 100}%`
  }

  it('positions blocks by clock time, not list order', () => {
    render(<DayTimeline plan={multiBlockPlan} />)

    const work = screen.getByLabelText(/work: write tests, session 1 of 2, 09:00–09:30/i)
    expect(work).toHaveStyle({ top: percent(0), height: percent(30) })

    const buffer = screen.getByLabelText(/buffer: buffer, 17:45–18:00/i)
    const bufferStartMinutes = 17 * 60 + 45 - windowMinutes
    expect(buffer).toHaveStyle({ top: percent(bufferStartMinutes), height: percent(15) })
  })

  it('styles each block kind distinctly and keeps the buffer an outlined empty slice', () => {
    render(<DayTimeline plan={multiBlockPlan} />)

    const work = screen.getByLabelText(/work: write tests, session 1 of 2/i)
    const buffer = screen.getByLabelText(/buffer: buffer, 17:45–18:00/i)
    const cadenceBreak = screen.getByLabelText(/cadence break: stretch/i)

    expect(work).toHaveAttribute('data-kind', 'WORK')
    expect(buffer).toHaveAttribute('data-kind', 'BUFFER')
    expect(cadenceBreak).toHaveAttribute('data-kind', 'CADENCE_BREAK')
    expect(work.className).not.toEqual(buffer.className)
    expect(buffer.className).toContain('border-dashed')
    expect(buffer.className).not.toContain('bg-primary')
  })

  it('exposes recordable work blocks as focusable and leaves other kinds static', () => {
    render(<DayTimeline plan={multiBlockPlan} onBlockClick={vi.fn()} />)

    const work = screen.getByRole('button', {
      name: /work: write tests, session 1 of 2, 09:00–09:30/i,
    })
    expect(work).toHaveAttribute('tabindex', '0')
    expect(
      screen.queryByRole('button', { name: /cadence break: stretch/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /buffer: buffer/i }),
    ).not.toBeInTheDocument()
    expect(screen.getByLabelText(/cadence break: stretch, 09:30–09:40/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/buffer: buffer, 17:45–18:00/i)).toBeInTheDocument()
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

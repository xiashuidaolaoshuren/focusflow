import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { WorkSessions } from '@/features/plans/WorkSessions'
import { sampleTaskSnapshot, sampleWorkBlock } from '@/features/plans/planFixtures'
import type { WorkBlockResponse } from '@/types/api'

function work(
  id: number,
  start: string,
  end: string,
  overrides: Partial<WorkBlockResponse> = {},
): WorkBlockResponse {
  return {
    ...sampleWorkBlock,
    id,
    startTime: start,
    endTime: end,
    taskSnapshot: { ...sampleTaskSnapshot, title: `Task ${id}` },
    ...overrides,
  }
}

describe('WorkSessions', () => {
  it('groups sessions under Recorded, Not recorded and No longer needed', () => {
    render(
      <WorkSessions
        blocks={[
          work(1, '09:00:00', '09:50:00', { outcome: 'DONE', actualMinutes: 50 }),
          work(3, '11:00:00', '11:50:00'),
          work(4, '12:00:00', '12:50:00', { displayState: 'NO_LONGER_NEEDED' }),
        ]}
      />,
    )

    expect(
      screen.getByRole('heading', { name: /work sessions/i }),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /^recorded/i })).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: /^not recorded/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: /^no longer needed/i }),
    ).toBeInTheDocument()
  })

  it('reads a block without an outcome as not recorded and shows the minutes', () => {
    render(
      <WorkSessions
        blocks={[
          work(1, '09:00:00', '09:50:00', { outcome: 'DONE', actualMinutes: 50 }),
          work(3, '11:00:00', '11:50:00'),
        ]}
      />,
    )

    const recorded = screen
      .getByRole('heading', { name: /^recorded/i })
      .parentElement!.querySelector('ul')!
    expect(within(recorded).getByText('Task 1')).toBeInTheDocument()
    expect(within(recorded).getByText('50m')).toBeInTheDocument()

    const notRecorded = screen
      .getByRole('heading', { name: /^not recorded/i })
      .parentElement!.querySelector('ul')!
    expect(within(notRecorded).getByText('Task 3')).toBeInTheDocument()
    expect(within(notRecorded).getByText('11:00–11:50')).toBeInTheDocument()
    expect(within(notRecorded).getByText('Not recorded')).toBeInTheDocument()
    expect(within(notRecorded).getByText('—')).toBeInTheDocument()
    expect(within(notRecorded).queryByText('Recorded')).toBeNull()
  })
})

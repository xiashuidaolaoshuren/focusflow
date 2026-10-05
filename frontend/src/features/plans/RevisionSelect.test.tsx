import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { RevisionSelect } from '@/features/plans/RevisionSelect'
import { sampleRevision } from '@/features/plans/planFixtures'
import type { PlanRevisionResponse } from '@/types/api'

const revisions: PlanRevisionResponse[] = [
  sampleRevision,
  {
    ...sampleRevision,
    id: 2,
    revisionNumber: 2,
    cutoff: '14:00:00',
  },
]

describe('RevisionSelect', () => {
  it('offers the composed current day plus every revision', async () => {
    render(
      <RevisionSelect
        revisions={revisions}
        selectedRevisionId={null}
        onSelect={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('combobox', { name: /revision/i }))

    expect(
      await screen.findByRole('option', { name: /current/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('option', { name: /revision 1/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('option', { name: /revision 2/i }),
    ).toBeInTheDocument()
  })

  it('reports the chosen revision and the composed view', async () => {
    const onSelect = vi.fn()
    render(
      <RevisionSelect
        revisions={revisions}
        selectedRevisionId={null}
        onSelect={onSelect}
      />,
    )

    fireEvent.click(screen.getByRole('combobox', { name: /revision/i }))
    const firstRevision = await screen.findByRole('option', {
      name: /revision 1/i,
    })
    fireEvent.pointerDown(firstRevision)
    fireEvent.click(firstRevision)

    expect(onSelect).toHaveBeenCalledWith(1)
  })
})

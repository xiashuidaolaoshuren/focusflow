import { render } from '@testing-library/react'
import { fireEvent, screen, within } from '@testing-library/dom'
import { describe, expect, it, vi } from 'vitest'

import { AgendaList } from '@/features/plans/AgendaList'
import { buildRail } from '@/features/plans/railModel'
import { railTestPlan } from '@/features/plans/railFixtures'

function renderAgenda(now: number | null, onSelect?: (id: number) => void) {
  const rail = buildRail(railTestPlan, now, 'comfortable')
  return render(
    onSelect ? (
      <AgendaList rail={rail} onSelect={onSelect} />
    ) : (
      <AgendaList rail={rail} />
    ),
  )
}

describe('AgendaList', () => {
  it('groups blocks by start hour in rail order', () => {
    renderAgenda(null)

    expect(
      screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent),
    ).toEqual(['09:00', '12:00', '14:00', '17:00'])

    const first = screen.getByRole('heading', { name: '09:00' }).closest('section')!
    const names = within(first)
      .getAllByRole('listitem')
      .map((item) => item.textContent)
    expect(names[0]).toContain('Write report')
    expect(names[1]).toContain('Cadence break')
  })

  it('puts the now row before the first block that starts later', () => {
    renderAgenda(10 * 60 + 30)

    const now = screen.getByRole('img', { name: 'Now 10:30' })
    const lunch = screen.getByText('Lunch')

    expect(
      now.compareDocumentPosition(lunch) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(screen.getAllByRole('img', { name: /^Now/ })).toHaveLength(1)
  })

  it('omits the now row when there is no clock', () => {
    renderAgenda(null)

    expect(screen.queryByRole('img', { name: /^Now/ })).toBeNull()
  })

  it('only makes recordable work rows selectable', () => {
    const onSelect = vi.fn()
    renderAgenda(null, onSelect)

    fireEvent.click(screen.getByRole('button', { name: /Write report/ }))
    expect(onSelect).toHaveBeenCalledWith(railTestPlan.composedRail[0]!.id)
    expect(screen.getAllByRole('button')).toHaveLength(1)
  })
})

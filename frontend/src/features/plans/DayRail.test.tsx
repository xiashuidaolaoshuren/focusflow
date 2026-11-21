import { render } from '@testing-library/react'
import { fireEvent, screen, within } from '@testing-library/dom'
import { describe, expect, it, vi } from 'vitest'

import { DayRail } from '@/features/plans/DayRail'
import { buildRail } from '@/features/plans/railModel'
import { railTestPlan } from '@/features/plans/railFixtures'

const NOW = 10 * 60 + 30

function renderRail(onSelect?: (id: number) => void) {
  const rail = buildRail(railTestPlan, NOW, 'comfortable')
  return render(
    onSelect ? <DayRail rail={rail} onSelect={onSelect} /> : <DayRail rail={rail} />,
  )
}

describe('DayRail', () => {
  it('renders one named list item per block', () => {
    renderRail()

    const track = screen.getByRole('list', { name: /daily plan blocks/i })
    const items = within(track).getAllByRole('listitem')

    expect(items).toHaveLength(5)
    expect(
      screen.getByLabelText(/^Work: Write report, 09:00–09:50, session 2 of 3/),
    ).toBeInTheDocument()
    expect(
      screen.getByLabelText('Cadence break: Cadence break, 09:50–10:00'),
    ).toBeInTheDocument()
    expect(screen.getByLabelText(/^Commitment: Dentist/)).toBeInTheDocument()
  })

  it('shows a stacked work block duration before its session label', () => {
    renderRail()

    expect(screen.getByText('09:00–09:50 · 50m · session 2 of 3')).toBeInTheDocument()
  })

  it('names fixed breaks and commitments by kind in the meta line', () => {
    renderRail()

    expect(screen.getByText('12:00–13:00 · Fixed break')).toBeInTheDocument()
    expect(screen.getByText('14:00–15:00 · Commitment')).toBeInTheDocument()
  })

  it('shows the now marker with its time', () => {
    renderRail()

    expect(screen.getByRole('img', { name: 'Now 10:30' })).toBeInTheDocument()
  })

  it('only makes recordable work blocks selectable', () => {
    const onSelect = vi.fn()
    renderRail(onSelect)

    fireEvent.click(screen.getByRole('button', { name: /^Work: Write report/ }))
    expect(onSelect).toHaveBeenCalledWith(railTestPlan.composedRail[0]!.id)

    expect(screen.queryByRole('button', { name: /Dentist/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Cadence break/ })).toBeNull()
  })
})

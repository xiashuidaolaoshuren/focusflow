import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { MiniRail } from '@/features/preferences/MiniRail'
import { typicalDay } from '@/features/preferences/typicalDay'
import { buildRail } from '@/features/plans/railModel'

const day = typicalDay({
  workDayStart: '09:00',
  workDayEnd: '12:00',
  bufferMinutes: 30,
  cadenceEnabled: true,
  targetFocusMinutes: 50,
  breakMinutes: 10,
  minSessionMinutes: 15,
  fixedBreaks: [{ label: 'Lunch', startTime: '10:00', endTime: '10:30' }],
  peakStart: null,
  peakEnd: null,
})!

describe('MiniRail', () => {
  it('draws one bar per block inside a labelled list, with no text in the bars', () => {
    const rail = buildRail(day.plan, null, 'mini')
    render(<MiniRail rail={rail} />)

    const list = screen.getByRole('list', { name: 'Typical day preview' })
    const bars = within(list).getAllByRole('listitem')

    expect(bars).toHaveLength(rail.blocks.length)
    for (const bar of bars) {
      expect(bar.textContent).toBe('')
    }
  })

  it('keeps the hour gutter labels', () => {
    const rail = buildRail(day.plan, null, 'mini')
    render(<MiniRail rail={rail} />)

    expect(screen.getByText('10:00')).toBeInTheDocument()
  })
})

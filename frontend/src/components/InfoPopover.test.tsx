import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { InfoPopover } from '@/components/InfoPopover'

describe('InfoPopover', () => {
  it('opens its explanation from the labelled trigger and closes on Escape', async () => {
    render(
      <InfoPopover label="About pace" title="Pace assumption">
        <p>Forecast days use 80% of a typical day.</p>
      </InfoPopover>,
    )

    const trigger = screen.getByRole('button', { name: 'About pace' })
    expect(screen.queryByText('Forecast days use 80% of a typical day.')).toBeNull()

    fireEvent.click(trigger)
    expect(screen.getByText('Pace assumption')).toBeInTheDocument()
    expect(screen.getByText('Forecast days use 80% of a typical day.')).toBeInTheDocument()

    fireEvent.keyDown(screen.getByText('Pace assumption'), { key: 'Escape' })
    await waitFor(() => {
      expect(screen.queryByText('Forecast days use 80% of a typical day.')).toBeNull()
    })
  })
})

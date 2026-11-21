import { render } from '@testing-library/react'
import { fireEvent, screen, waitFor, within } from '@testing-library/dom'
import { describe, expect, it, vi } from 'vitest'

import { DateField } from '@/components/form/DateField'

function openCalendar(triggerName: RegExp) {
  fireEvent.click(screen.getByRole('button', { name: triggerName }))
  return within(screen.getByRole('dialog'))
}

describe('DateField', () => {
  it('shows the formatted label and never uses a native date input', () => {
    const { container } = render(
      <DateField value="2026-11-06" onChange={() => {}} />,
    )
    expect(
      screen.getByRole('button', { name: /6 Nov 2026/i }),
    ).toBeInTheDocument()
    expect(container.querySelector('input[type="date"]')).toBeNull()
  })

  it('opens an English month heading and selects a day', () => {
    const onChange = vi.fn()
    render(<DateField value="2026-11-06" onChange={onChange} />)
    const dialog = openCalendar(/6 Nov 2026/i)
    expect(dialog.getByRole('heading', { name: /November 2026/i })).toBeInTheDocument()
    fireEvent.click(dialog.getByLabelText('15 November 2026'))
    expect(onChange).toHaveBeenCalledWith('2026-11-15')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('disables days outside min and max', () => {
    const onChange = vi.fn()
    render(
      <DateField
        value="2026-11-06"
        min="2026-11-06"
        max="2026-11-10"
        onChange={onChange}
      />,
    )
    const dialog = openCalendar(/6 Nov 2026/i)
    const tooEarly = dialog.getByLabelText('5 November 2026')
    expect(tooEarly).toBeDisabled()
    fireEvent.click(tooEarly)
    expect(onChange).not.toHaveBeenCalled()
    expect(dialog.getByLabelText('6 November 2026')).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })

  it('moves focus with arrow keys and closes on Escape', async () => {
    render(<DateField value="2026-11-06" onChange={() => {}} />)
    const trigger = screen.getByRole('button', { name: /6 Nov 2026/i })
    const dialog = openCalendar(/6 Nov 2026/i)
    const day = dialog.getByLabelText('6 November 2026')
    day.focus()
    fireEvent.keyDown(day, { key: 'ArrowRight', bubbles: true })
    await waitFor(() => {
      expect(dialog.getByLabelText('7 November 2026')).toHaveAttribute(
        'tabindex',
        '0',
      )
    })
    fireEvent.keyDown(dialog.getByRole('grid'), { key: 'Escape' })
    await waitFor(() => expect(trigger).toHaveFocus())
  })
})

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { act } from 'react'

import { TimeField } from '@/components/form/TimeField'

describe('TimeField', () => {
  it('normalizes on blur and rejects invalid input without native time control', async () => {
    const onChange = vi.fn()
    const { container } = render(
      <TimeField value="" onChange={onChange} />,
    )
    expect(container.querySelector('input[type="time"]')).toBeNull()
    const input = screen.getByRole('textbox')
    await act(async () => {
      fireEvent.focus(input)
      fireEvent.change(input, { target: { value: '1745' } })
      fireEvent.blur(input)
    })
    await waitFor(() => {
      expect(onChange).toHaveBeenLastCalledWith('17:45')
    })

    await act(async () => {
      fireEvent.change(input, { target: { value: '25:00' } })
      fireEvent.blur(input)
    })
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveValue('25:00')
  })

  it('explains an invalid time on blur, not while typing', () => {
    render(<TimeField value="09:00" onChange={vi.fn()} />)
    const input = screen.getByRole('textbox')

    fireEvent.change(input, { target: { value: '99:99' } })
    expect(screen.queryByText('Use 24-hour HH:MM, e.g. 09:30.')).not.toBeInTheDocument()

    fireEvent.blur(input)
    expect(screen.getByText('Use 24-hour HH:MM, e.g. 09:30.')).toBeInTheDocument()
  })

  it('steps by 5 minutes with ArrowUp and by 60 with Shift+ArrowUp', () => {
    const onChange = vi.fn()
    const { unmount } = render(<TimeField value="10:00" onChange={onChange} />)
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'ArrowUp' })
    expect(onChange).toHaveBeenLastCalledWith('10:05')
    unmount()

    render(<TimeField value="10:00" onChange={onChange} />)
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'ArrowUp', shiftKey: true })
    expect(onChange).toHaveBeenLastCalledWith('11:00')
  })
})

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
})

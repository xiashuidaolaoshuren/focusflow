import { describe, expect, it } from 'vitest'

import {
  commitmentErrorMessage,
  outsideWorkWindowMessage,
} from '@/features/commitments/commitmentMessages'
import { ApiError } from '@/lib/api'

function apiError(message: string) {
  return new ApiError({
    status: 400,
    message,
  } as unknown as ConstructorParameters<typeof ApiError>[0])
}

describe('commitmentErrorMessage', () => {
  it('turns the overlap rejection into plain English', () => {
    expect(
      commitmentErrorMessage(apiError('commitments must not overlap on the same date')),
    ).toBe('That time overlaps another commitment.')
  })

  it('passes any other message through unchanged', () => {
    expect(commitmentErrorMessage(new Error('Server unavailable'))).toBe('Server unavailable')
  })
})

describe('outsideWorkWindowMessage', () => {
  const window = { workDayStart: '09:00:00', workDayEnd: '18:00:00' }

  it('names the Work window when a time falls outside it', () => {
    expect(outsideWorkWindowMessage('03:00', '04:00', window)).toBe(
      'Keep it inside the Work window (09:00–18:00).',
    )
  })

  it('accepts a commitment that sits inside the window, including its edges', () => {
    expect(outsideWorkWindowMessage('09:00', '09:30', window)).toBeNull()
    expect(outsideWorkWindowMessage('17:30', '18:00', window)).toBeNull()
  })
})

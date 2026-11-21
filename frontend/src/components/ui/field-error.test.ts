import { describe, expect, it } from 'vitest'

import { getFieldError } from '@/components/ui/field-error'
import { ApiError } from '@/lib/api'

function apiErrorWith(details: Record<string, string[]>) {
  return new ApiError({
    status: 400,
    message: 'Invalid scheduling preferences',
    details,
  } as unknown as ConstructorParameters<typeof ApiError>[0])
}

describe('getFieldError', () => {
  it('finds a server detail keyed with Spring list brackets for a form path with dots', () => {
    const error = apiErrorWith({ 'fixedBreaks[0].label': ['Label is required'] })

    expect(getFieldError(error, 'fixedBreaks.0.label')).toBe('Label is required')
  })
})

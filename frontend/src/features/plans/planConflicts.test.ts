import { describe, expect, it } from 'vitest'

import { ApiError } from '@/lib/api'
import { deletePlanErrorMessage } from '@/features/plans/planConflicts'

function apiError(status: number, code: string | null, message = 'raw server message') {
  return new ApiError({ status, code, message, error: 'Conflict', path: '/api/daily-plans/1', timestamp: '2026-11-15T10:00:00Z' } as never)
}

describe('deletePlanErrorMessage', () => {
  it('explains that a plan with recorded progress cannot be deleted', () => {
    expect(deletePlanErrorMessage(apiError(409, 'PLAN_HAS_PROGRESS'))).toBe(
      'This plan has recorded progress, so it cannot be deleted. Its history stays as it is.',
    )
  })

  it('falls back to a generic message for any other error', () => {
    expect(deletePlanErrorMessage(new Error('network down'))).toBe('Could not delete the plan.')
    expect(deletePlanErrorMessage(apiError(500, null))).toBe('Could not delete the plan.')
  })
})

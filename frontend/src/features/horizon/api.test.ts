import { afterEach, describe, expect, it, vi } from 'vitest'

import type { HorizonResponse } from '@/types/api'

import { getHorizon } from '@/features/horizon/api'

describe('getHorizon', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('requests GET /api/horizon with currentDate and currentTime query params', async () => {
    const body: HorizonResponse = {
      currentDate: '2026-06-01',
      currentTime: '09:00:00',
      assumptions: {
        pace: 'AS_PLANNED',
        workingDays: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'],
        horizonWorkingDays: 7,
      },
      days: [],
      tasks: [],
    }
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(getHorizon('2026-06-01', '09:00')).resolves.toEqual(body)
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(
        /\/api\/horizon\?.*currentDate=2026-06-01.*currentTime=09%3A00/,
      ),
      expect.objectContaining({ credentials: 'include' }),
    )
  })
})

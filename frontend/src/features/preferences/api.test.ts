import { afterEach, describe, expect, it, vi } from 'vitest'

import type {
  SchedulingPreferencesRequest,
  SchedulingPreferencesResponse,
} from '@/types/api'

import {
  getSchedulingPreferences,
  updateSchedulingPreferences,
} from '@/features/preferences/api'

const defaultPreferences: SchedulingPreferencesResponse = {
  workDayStart: '09:00:00',
  workDayEnd: '18:00:00',
  cadenceEnabled: true,
  targetFocusMinutes: 50,
  breakMinutes: 10,
  minSessionMinutes: 15,
  bufferMinutes: 0,
  peakStart: null,
  peakEnd: null,
  fixedBreaks: [],
  persisted: false,
}

describe('getSchedulingPreferences', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns effective preferences on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(defaultPreferences), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    )

    await expect(getSchedulingPreferences()).resolves.toEqual(defaultPreferences)
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/scheduling-preferences'),
      expect.objectContaining({ credentials: 'include' }),
    )
  })
})

describe('updateSchedulingPreferences', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('PUTs the aggregate and returns persisted preferences', async () => {
    const request: SchedulingPreferencesRequest = {
      workDayStart: '08:00:00',
      workDayEnd: '17:00:00',
      cadenceEnabled: false,
      targetFocusMinutes: 45,
      breakMinutes: 10,
      minSessionMinutes: 20,
      bufferMinutes: 15,
      peakStart: '10:00:00',
      peakEnd: '12:00:00',
      fixedBreaks: [
        { label: 'Lunch', startTime: '12:00:00', endTime: '13:00:00' },
      ],
    }
    const saved: SchedulingPreferencesResponse = {
      ...request,
      persisted: true,
    }
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(saved), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(updateSchedulingPreferences(request)).resolves.toEqual(saved)
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/scheduling-preferences'),
      expect.objectContaining({
        method: 'PUT',
        credentials: 'include',
        body: JSON.stringify(request),
      }),
    )
  })
})

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { HorizonResponse } from '@/types/api'

vi.mock('@/features/horizon/api', () => ({
  getHorizon: vi.fn(),
}))

vi.mock('@/lib/planningDate', () => ({
  getLocalDateString: vi.fn(() => '2026-06-01'),
  getLocalTimeString: vi.fn(() => '09:00:00'),
}))

import { getHorizon } from '@/features/horizon/api'
import { getLocalDateString, getLocalTimeString } from '@/lib/planningDate'
import {
  horizonQueryKey,
  horizonQueryPrefix,
  useHorizon,
  useHorizonClock,
} from '@/features/horizon/hooks'

const mockedGetHorizon = vi.mocked(getHorizon)
const mockedGetLocalDateString = vi.mocked(getLocalDateString)
const mockedGetLocalTimeString = vi.mocked(getLocalTimeString)

const sampleHorizon: HorizonResponse = {
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

function createWrapper(queryClient?: QueryClient) {
  const client =
    queryClient ??
    new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    )
  }
}

describe('horizonQueryKey', () => {
  it('includes horizon prefix, date, and minute-aligned time', () => {
    expect(horizonQueryKey('2026-06-01', '09:00')).toEqual([
      'horizon',
      '2026-06-01',
      '09:00',
    ])
  })
})

describe('useHorizon', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('fetches horizon with clock-derived date and minute-aligned time', async () => {
    mockedGetLocalDateString.mockReturnValue('2026-06-01')
    mockedGetLocalTimeString.mockReturnValue('09:00:00')
    mockedGetHorizon.mockResolvedValue(sampleHorizon)
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    })
    const { result } = renderHook(() => useHorizon(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(mockedGetHorizon).toHaveBeenCalledWith('2026-06-01', '09:00')
    expect(result.current.horizon).toEqual(sampleHorizon)
  })


  it('refetches when the document becomes visible', async () => {
    mockedGetLocalDateString.mockReturnValue('2026-06-01')
    mockedGetLocalTimeString.mockReturnValue('09:00:00')
    mockedGetHorizon.mockResolvedValue(sampleHorizon)
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    })

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    renderHook(() => useHorizon(), {
      wrapper: createWrapper(queryClient),
    })

    await waitFor(() => {
      expect(mockedGetHorizon).toHaveBeenCalledTimes(1)
    })

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    })
    document.dispatchEvent(new Event('visibilitychange'))

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: horizonQueryPrefix,
      })
    })
  })

})

describe('useHorizonClock', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('updates minute-aligned time after 60 seconds while visible', async () => {
    vi.useFakeTimers()
    let time = '09:00:00'
    mockedGetLocalDateString.mockReturnValue('2026-06-01')
    mockedGetLocalTimeString.mockImplementation(() => time)
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    })

    const { result } = renderHook(() => useHorizonClock())

    expect(result.current.currentTime).toBe('09:00')

    time = '09:01:00'
    await act(async () => {
      vi.advanceTimersByTime(60_000)
    })

    expect(result.current.currentTime).toBe('09:01')
  })

  it('does not advance the minute interval while hidden', async () => {
    vi.useFakeTimers()
    mockedGetLocalDateString.mockReturnValue('2026-06-01')
    mockedGetLocalTimeString.mockReturnValue('09:00:00')
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'hidden',
    })

    const { result } = renderHook(() => useHorizonClock())

    mockedGetLocalTimeString.mockReturnValue('09:01:00')
    await act(async () => {
      vi.advanceTimersByTime(60_000)
    })

    expect(result.current.currentTime).toBe('09:00')
  })
})

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { horizonQueryPrefix } from '@/features/horizon/hooks'
import type { CommitmentResponse, SchedulingPreferencesResponse } from '@/types/api'

vi.mock('@/features/preferences/api', () => ({
  getSchedulingPreferences: vi.fn(),
  updateSchedulingPreferences: vi.fn(),
}))

vi.mock('@/features/commitments/api', () => ({
  createCommitment: vi.fn(),
  deleteCommitment: vi.fn(),
  listCommitments: vi.fn(),
  updateCommitment: vi.fn(),
}))

vi.mock('@/features/plans/regeneratePrompt', () => ({
  markRegeneratePromptNeeded: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn() },
}))

import {
  createCommitment,
  deleteCommitment,
  updateCommitment,
} from '@/features/commitments/api'
import { useCreateCommitment, useDeleteCommitment, useUpdateCommitment } from '@/features/commitments/hooks'
import { updateSchedulingPreferences } from '@/features/preferences/api'
import { useUpdateSchedulingPreferences } from '@/features/preferences/hooks'

const mockedUpdateSchedulingPreferences = vi.mocked(updateSchedulingPreferences)
const mockedCreateCommitment = vi.mocked(createCommitment)
const mockedUpdateCommitment = vi.mocked(updateCommitment)
const mockedDeleteCommitment = vi.mocked(deleteCommitment)

function createWrapper(queryClient?: QueryClient) {
  const client =
    queryClient ??
    new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    )
  }
}

const preferencesResponse: SchedulingPreferencesResponse = {
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
  workingDays: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'],
  persisted: true,
}

const commitmentResponse: CommitmentResponse = {
  id: 1,
  commitmentDate: '2026-06-15',
  startTime: '12:00:00',
  endTime: '13:00:00',
  title: 'Lunch',
}

describe('horizon invalidations', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('invalidates horizon when scheduling preferences are saved', async () => {
    mockedUpdateSchedulingPreferences.mockResolvedValue(preferencesResponse)
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useUpdateSchedulingPreferences(), {
      wrapper: createWrapper(queryClient),
    })

    result.current.mutate({
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
      workingDays: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'],
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: horizonQueryPrefix })
  })

  it('invalidates horizon when commitments change', async () => {
    mockedCreateCommitment.mockResolvedValue(commitmentResponse)
    mockedUpdateCommitment.mockResolvedValue(commitmentResponse)
    mockedDeleteCommitment.mockResolvedValue(undefined)

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const createHook = renderHook(() => useCreateCommitment('2026-06-15'), {
      wrapper: createWrapper(queryClient),
    })
    createHook.result.current.mutate({
      commitmentDate: '2026-06-15',
      startTime: '12:00:00',
      endTime: '13:00:00',
      title: 'Lunch',
    })
    await waitFor(() => expect(createHook.result.current.isSuccess).toBe(true))

    const updateHook = renderHook(() => useUpdateCommitment('2026-06-15'), {
      wrapper: createWrapper(queryClient),
    })
    updateHook.result.current.mutate({
      id: 1,
      request: {
        commitmentDate: '2026-06-15',
        startTime: '12:30:00',
        endTime: '13:00:00',
        title: 'Lunch',
      },
    })
    await waitFor(() => expect(updateHook.result.current.isSuccess).toBe(true))

    const deleteHook = renderHook(() => useDeleteCommitment('2026-06-15'), {
      wrapper: createWrapper(queryClient),
    })
    deleteHook.result.current.mutate(1)
    await waitFor(() => expect(deleteHook.result.current.isSuccess).toBe(true))

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: horizonQueryPrefix })
  })
})

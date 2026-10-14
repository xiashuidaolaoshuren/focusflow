import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { HorizonPage } from '@/features/horizon/HorizonPage'
import type { HorizonResponse, SchedulingPreferencesResponse } from '@/types/api'

vi.mock('@/features/horizon/hooks', () => ({
  useHorizon: vi.fn(),
}))

vi.mock('@/features/preferences/hooks', () => ({
  useSchedulingPreferences: vi.fn(),
}))

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>()
  return {
    ...actual,
    useQueries: vi.fn(() => []),
  }
})

import { useHorizon } from '@/features/horizon/hooks'
import { useSchedulingPreferences } from '@/features/preferences/hooks'

const mockedUseHorizon = vi.mocked(useHorizon)
const mockedUseSchedulingPreferences = vi.mocked(useSchedulingPreferences)

const preferences: SchedulingPreferencesResponse = {
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

const horizon: HorizonResponse = {
  currentDate: '2026-06-01',
  currentTime: '09:00:00',
  assumptions: {
    pace: 'AS_PLANNED',
    workingDays: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'],
    horizonWorkingDays: 7,
  },
  days: [
    {
      date: '2026-06-01',
      kind: 'SAVED',
      planId: 1,
      needsRefresh: false,
      dependenciesIgnored: [],
    },
    {
      date: '2026-06-02',
      kind: 'FORECAST',
      planId: null,
      needsRefresh: null,
      dependenciesIgnored: [],
    },
  ],
  tasks: [
    {
      taskId: 10,
      title: 'Write report',
      status: 'OPEN',
      dueDate: '2026-06-02',
      remainingEffortMinutes: 60,
      deadlineStatus: 'AT_RISK',
      projectedFinishDate: '2026-06-03',
      waitingOn: [],
      upstreamBlockers: [],
      unresolvedEffort: [],
      segments: [
        {
          date: '2026-06-01',
          minutes: 60,
          assumedCreditMinutes: 60,
          creditExclusions: [],
          unplacedReason: null,
          unplacedMinutes: null,
          unplacedScope: null,
        },
      ],
    },
  ],
}

function renderHorizonPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <HorizonPage />
    </QueryClientProvider>,
  )
}

describe('HorizonPage', () => {
  it('renders saved and forecast headers with task rows and accessible segments', () => {
    mockedUseHorizon.mockReturnValue({
      horizon,
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useHorizon>)
    mockedUseSchedulingPreferences.mockReturnValue({
      preferences,
    } as ReturnType<typeof useSchedulingPreferences>)

    renderHorizonPage()

    expect(screen.getByText('Saved')).toBeInTheDocument()
    expect(screen.getByText('Forecast')).toBeInTheDocument()
    expect(screen.getByText('Write report')).toBeInTheDocument()
    expect(screen.getByText(/Due 2026-06-02/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Write report, 2026-06-01, 60 minutes displayed, saved day/i)).toBeInTheDocument()
    expect(screen.getByText('Due')).toBeInTheDocument()
  })

  it('shows a loading skeleton while pending', () => {
    mockedUseHorizon.mockReturnValue({
      horizon: null,
      isPending: true,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useHorizon>)
    mockedUseSchedulingPreferences.mockReturnValue({
      preferences: null,
      isPending: true,
    } as ReturnType<typeof useSchedulingPreferences>)

    renderHorizonPage()

    expect(screen.getByRole('status', { name: /loading horizon/i })).toBeInTheDocument()
  })

  it('shows an error alert with retry', () => {
    const refetch = vi.fn()
    mockedUseHorizon.mockReturnValue({
      horizon: null,
      isPending: false,
      isError: true,
      error: new Error('network'),
      refetch,
    } as unknown as ReturnType<typeof useHorizon>)
    mockedUseSchedulingPreferences.mockReturnValue({
      preferences,
    } as ReturnType<typeof useSchedulingPreferences>)

    renderHorizonPage()

    expect(screen.getByText(/could not load horizon/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
  })
})

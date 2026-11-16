import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { HorizonPage } from '@/features/horizon/HorizonPage'
import {
  forecastHeaderCopy,
  HORIZON_PACE_COPY,
  savedConflictCopy,
} from '@/features/horizon/horizonGrid'
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

const horizonDay0 = horizon.days[0]!
const horizonDay1 = horizon.days[1]!
const horizonTask0 = horizon.tasks[0]!
const conflictedDay0 = { ...horizonDay0, dependenciesIgnored: [10] }

const conflictedHorizon: HorizonResponse = {
  ...horizon,
  days: [conflictedDay0, horizonDay1],
  tasks: [
    {
      ...horizonTask0,
      waitingOn: [{ taskId: 2, title: 'Blocker' }],
      upstreamBlockers: [{ taskId: 3, title: 'Upstream' }],
    },
    {
      ...horizonTask0,
      taskId: 2,
      title: 'Blocker',
      deadlineStatus: null,
      waitingOn: [],
      upstreamBlockers: [],
      segments: [],
    },
    {
      ...horizonTask0,
      taskId: 3,
      title: 'Upstream',
      deadlineStatus: null,
      waitingOn: [],
      upstreamBlockers: [],
      segments: [],
    },
  ],
}

function mockHorizon(horizonResponse: HorizonResponse) {
  mockedUseHorizon.mockReturnValue({
    horizon: horizonResponse,
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useHorizon>)
  mockedUseSchedulingPreferences.mockReturnValue({
    preferences,
  } as ReturnType<typeof useSchedulingPreferences>)
}

function setViewport(width: number) {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: width,
  })
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: width < 768 && query.includes('max-width'),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  })
}

describe('HorizonPage', () => {
  beforeEach(() => {
    setViewport(1024)
  })

  it('renders the day list instead of the grid below 768px', () => {
    setViewport(375)
    mockHorizon(horizon)

    renderHorizonPage()

    expect(screen.queryByLabelText('Horizon grid')).toBeNull()
    expect(screen.getByRole('heading', { name: '1 Jun 2026' })).toBeInTheDocument()
    expect(screen.getByText('No work forecast')).toBeInTheDocument()
  })

  it('renders the grid and no day list at 768px and wider', () => {
    setViewport(768)
    mockHorizon(horizon)

    renderHorizonPage()

    expect(screen.getByLabelText('Horizon grid')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '1 Jun 2026' })).toBeNull()
  })

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
    expect(screen.getByText('Due 2 Jun 2026')).toBeInTheDocument()
    expect(screen.getByText('Seven working days from 1 Jun 2026 at 09:00')).toBeInTheDocument()
    expect(screen.getByLabelText(/Write report, 2026-06-01, 60 minutes displayed, saved day/i)).toBeInTheDocument()
    expect(screen.getByText('Due')).toBeInTheDocument()
  })

  it('labels each header with a formatted date, its total, and a saved shortfall', () => {
    const shortfallHorizon: HorizonResponse = {
      ...horizon,
      tasks: [
        {
          ...horizonTask0,
          segments: [
            {
              date: '2026-06-01',
              minutes: 60,
              assumedCreditMinutes: null,
              creditExclusions: [],
              unplacedReason: 'OUT_OF_TIME',
              unplacedMinutes: 30,
              unplacedScope: 'SAVED_SHORTFALL',
            },
          ],
        },
      ],
    }
    mockHorizon(shortfallHorizon)

    renderHorizonPage()

    expect(screen.getByText('1 Jun 2026')).toBeInTheDocument()
    expect(screen.getByText('2 Jun 2026')).toBeInTheDocument()
    expect(screen.getByText('1h')).toBeInTheDocument()
    expect(screen.getByText('Shortfall 30m')).toBeInTheDocument()
  })

  it('highlights blocker rows on keyboard focus and clears them on blur', () => {
    mockHorizon(conflictedHorizon)

    renderHorizonPage()

    const titleCell = screen.getByText('Write report')
    fireEvent.focus(titleCell)

    expect(screen.getByTestId('horizon-row-2')).toHaveAttribute(
      'data-highlighted',
      'true',
    )

    fireEvent.blur(titleCell)

    expect(screen.getByTestId('horizon-row-2')).not.toHaveAttribute(
      'data-highlighted',
    )
  })

  it('puts a due date that falls between two columns at the edge of the day before', () => {
    const edgeHorizon: HorizonResponse = {
      ...horizon,
      days: [horizonDay0, { ...horizonDay1, date: '2026-06-03' }],
      tasks: [{ ...horizonTask0, dueDate: '2026-06-02', deadlineStatus: null, segments: [] }],
    }
    mockHorizon(edgeHorizon)

    renderHorizonPage()

    const marker = screen.getByText('Tue')
    expect(marker.closest('[data-due-marker]')).toHaveAttribute('data-due-marker', 'edge')
    expect(marker.closest('[data-due-marker]')?.querySelector('svg')).not.toBeNull()
  })

  it('shows every deadline state as a glyph and a word', () => {
    const states = ['ON_TRACK', 'AT_RISK', 'OVERDUE', 'CANNOT_FORECAST', 'BEYOND_HORIZON'] as const
    const deadlineHorizon: HorizonResponse = {
      ...horizon,
      tasks: states.map((status, index) => ({
        ...horizonTask0,
        taskId: 100 + index,
        title: `Task ${status}`,
        deadlineStatus: status,
        unresolvedEffort: status === 'CANNOT_FORECAST' ? [{ taskId: 2, title: 'Blocker' }] : [],
        segments: [],
      })),
    }
    mockHorizon(deadlineHorizon)

    renderHorizonPage()

    const labels: Array<[string, string]> = [
      ['ON_TRACK', 'On track'],
      ['AT_RISK', 'At risk'],
      ['OVERDUE', 'Overdue'],
      ['CANNOT_FORECAST', "Can't forecast: Blocker"],
      ['BEYOND_HORIZON', 'Beyond horizon'],
    ]
    for (const [status, text] of labels) {
      const badge = screen.getByText(text).closest('[data-deadline]')
      expect(badge).toHaveAttribute('data-deadline', status)
      expect(badge?.querySelector('svg')).not.toBeNull()
    }
  })

  it('explains every deadline state behind an ⓘ on the deadline forecast legend', () => {
    mockHorizon(horizon)

    renderHorizonPage()

    expect(screen.queryByText("Can't forecast")).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /about deadline forecasts/i }))
    for (const text of ['On track', 'Overdue', "Can't forecast", 'Beyond horizon']) {
      expect(screen.getByText(text)).toBeInTheDocument()
    }
    expect(screen.getAllByText('At risk').length).toBeGreaterThanOrEqual(2)
  })

  it('shows an empty state with a way to Tasks when nothing is scheduled', () => {
    mockHorizon({ ...horizon, days: [], tasks: [] })

    renderHorizonPage()

    expect(screen.getByText('Nothing on the Horizon')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /go to tasks/i })).toHaveAttribute(
      'href',
      '/tasks',
    )
  })

  it('has no start-date picker: the window is read from the server', () => {
    mockHorizon(horizon)

    const { container } = renderHorizonPage()

    expect(container.querySelector('input[type="date"]')).toBeNull()
    expect(screen.queryByLabelText(/start date/i)).toBeNull()
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

  it('states the as-planned assumption and explains a saved conflict', () => {
    mockHorizon(conflictedHorizon)

    renderHorizonPage()

    expect(screen.queryByText(HORIZON_PACE_COPY)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /about pace assumption/i }))
    expect(screen.getByText(HORIZON_PACE_COPY)).toBeInTheDocument()
    expect(
      screen.getByText(savedConflictCopy(conflictedDay0) as string),
    ).toBeInTheDocument()
  })

  it('marks a forecast header with a dashboard link and puts the fixed order behind the pace ⓘ', () => {
    mockHorizon(horizon)

    renderHorizonPage()

    expect(screen.queryByText(forecastHeaderCopy())).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /about pace assumption/i }))
    expect(screen.getByText(forecastHeaderCopy())).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /open in today/i }),
    ).toHaveAttribute('href', '/today?date=2026-06-02')
  })

  it('names the upstream cause and highlights the blocker rows on hover', () => {
    mockHorizon(conflictedHorizon)

    renderHorizonPage()

    expect(screen.getByText('Waiting on Blocker')).toBeInTheDocument()
    expect(screen.getByText('Upstream cause: Upstream')).toBeInTheDocument()

    fireEvent.mouseEnter(screen.getByTestId('horizon-row-10'))

    expect(screen.getByTestId('horizon-row-2')).toHaveAttribute(
      'data-highlighted',
      'true',
    )
    expect(screen.getByTestId('horizon-row-3')).not.toHaveAttribute(
      'data-highlighted',
    )
    expect(screen.getByTestId('horizon-row-10')).not.toHaveAttribute(
      'data-highlighted',
    )

    fireEvent.mouseLeave(screen.getByTestId('horizon-row-10'))

    expect(screen.getByTestId('horizon-row-2')).not.toHaveAttribute(
      'data-highlighted',
    )
  })
})

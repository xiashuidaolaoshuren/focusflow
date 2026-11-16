import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { screen, waitFor, within } from '@testing-library/dom'
import { fireEvent } from '@testing-library/dom'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('@/features/plans/hooks', () => ({
  usePlanByDate: vi.fn(),
  useGeneratePlan: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useReplan: vi.fn(() => ({ mutate: vi.fn(), isPending: false, error: null })),
}))

vi.mock('@/features/tasks/hooks', () => ({
  useTasks: vi.fn(() => ({ tasks: [] })),
}))

vi.mock('@/features/commitments/hooks', () => ({
  useCommitments: vi.fn(() => ({
    commitments: [],
    isPending: false,
    isError: false,
    error: null,
  })),
  useCreateCommitment: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useUpdateCommitment: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useDeleteCommitment: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
}))

vi.mock('@/features/preferences/hooks', () => ({
  useSchedulingPreferences: vi.fn(() => ({ preferences: null })),
}))

vi.mock('@/features/horizon/hooks', () => ({
  useHorizon: vi.fn(() => ({ horizon: null, isPending: false, isError: false })),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn() },
}))

vi.mock('@/features/plans/OutcomeDialog', () => ({
  OutcomeDialog: ({
    block,
    onClose,
  }: {
    block: { taskSnapshot: { title: string } }
    onClose: () => void
  }) => (
    <div role="dialog" aria-label="Outcome dialog">
      <p>{block.taskSnapshot.title}</p>
      <button type="button" onClick={onClose}>
        Close outcome
      </button>
    </div>
  ),
}))

import { useCommitments } from '@/features/commitments/hooks'
import { usePlanByDate } from '@/features/plans/hooks'
import { useSchedulingPreferences } from '@/features/preferences/hooks'
import {
  clearRegeneratePrompt,
  markRegeneratePromptNeeded,
} from '@/features/plans/regeneratePrompt'
import { progressPlan } from '@/features/plans/planFixtures'
import { railTestPlan } from '@/features/plans/railFixtures'
import { getLocalDateString } from '@/lib/planningDate'
import { TodayPage } from '@/routes/TodayPage'

const mockedUsePlanByDate = vi.mocked(usePlanByDate)
const mockedUseCommitments = vi.mocked(useCommitments)
const mockedUseSchedulingPreferences = vi.mocked(useSchedulingPreferences)

function mockPreferences(windowEnd = '18:00:00', windowStart = '09:00:00') {
  mockedUseSchedulingPreferences.mockReturnValue({
    preferences: {
      workDayStart: windowStart,
      workDayEnd: windowEnd,
      cadenceEnabled: true,
      targetFocusMinutes: 50,
      breakMinutes: 10,
      minSessionMinutes: 15,
      bufferMinutes: 0,
      peakStart: null,
      peakEnd: null,
      fixedBreaks: [{ label: 'Lunch', startTime: '12:00:00', endTime: '13:00:00' }],
      workingDays: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'],
      persisted: true,
    },
  } as unknown as ReturnType<typeof useSchedulingPreferences>)
}

function mockDayCommitments() {
  mockedUseCommitments.mockReturnValue({
    commitments: [
      {
        id: 7,
        title: 'Dentist',
        commitmentDate: '2026-11-06',
        startTime: '15:00:00',
        endTime: '15:30:00',
      },
    ],
    isPending: false,
    isError: false,
    error: null,
  } as unknown as ReturnType<typeof useCommitments>)
}

function LocationProbe() {
  const { search } = useLocation()
  return <output data-testid="location">{search}</output>
}

function mockPlan(overrides: Partial<ReturnType<typeof usePlanByDate>> = {}) {
  mockedUsePlanByDate.mockReturnValue({
    plan: null,
    hasPlan: false,
    isPending: false,
    isError: false,
    refetch: vi.fn(),
    ...overrides,
  } as unknown as ReturnType<typeof usePlanByDate>)
}

function renderToday(initialPath: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <TodayPage />
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('TodayPage', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })
    mockPlan()
    mockedUseCommitments.mockReturnValue({
      commitments: [],
      isPending: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useCommitments>)
    mockedUseSchedulingPreferences.mockReturnValue({
      preferences: null,
    } as unknown as ReturnType<typeof useSchedulingPreferences>)
  })

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 1024,
    })
  })

  it('loads the plan for the date in the query', () => {
    mockPlan({ isPending: true })

    renderToday('/today?date=2026-11-06')

    expect(mockedUsePlanByDate).toHaveBeenCalledWith('2026-11-06')
  })

  it('falls back to today and replaces an invalid date in the query', async () => {
    mockPlan()

    renderToday('/today?date=garbage')

    expect(mockedUsePlanByDate).toHaveBeenCalledWith(getLocalDateString())
    await waitFor(() => {
      expect(screen.getByTestId('location').textContent).toBe(
        `?date=${getLocalDateString()}`,
      )
    })
  })

  it('shows the compact Tasks card beside the rail', () => {
    mockPlan({ plan: railTestPlan, hasPlan: true })

    renderToday(`/today?date=${getLocalDateString()}`)

    expect(screen.getByRole('heading', { name: 'Tasks' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'All tasks' })).toHaveAttribute('href', '/tasks')
  })

  it('puts the rail explanations and the Peak chip in the Day rail header', () => {
    mockPlan({ plan: railTestPlan, hasPlan: true })

    renderToday(`/today?date=${getLocalDateString()}`)

    const railSection = screen
      .getByRole('heading', { name: 'Day rail' })
      .closest('section') as HTMLElement
    expect(
      within(railSection).getByRole('button', { name: 'About block kinds' }),
    ).toBeInTheDocument()
    expect(
      within(railSection).getByRole('button', { name: 'About outcomes' }),
    ).toBeInTheDocument()
    expect(within(railSection).getByText('Peak window')).toBeInTheDocument()
    expect(within(railSection).getByText('09:30–12:00')).toBeInTheDocument()
    expect(
      within(railSection).getByRole('button', { name: 'About the Peak window' }),
    ).toBeInTheDocument()
  })

  it('hides the Peak chip when the plan has no peak window', () => {
    mockPlan({
      plan: { ...railTestPlan, peakStart: null, peakEnd: null },
      hasPlan: true,
    })

    renderToday(`/today?date=${getLocalDateString()}`)

    expect(screen.queryByText('Peak window')).toBeNull()
  })

  it('shows fixed breaks and commitments on the rail before a plan exists', () => {
    mockPlan({ plan: null })
    mockPreferences()
    mockDayCommitments()

    renderToday('/today?date=2026-11-06')

    const blocks = screen.getByRole('list', { name: 'Daily plan blocks' })
    expect(
      within(blocks).getByRole('listitem', { name: /fixed break: lunch/i }),
    ).toBeInTheDocument()
    expect(
      within(blocks).getByRole('listitem', { name: /commitment: dentist/i }),
    ).toBeInTheDocument()
  })

  it('draws the now-line on a plan-less today but not on another day', () => {
    mockPlan({ plan: null })
    mockPreferences('23:59:00', '00:00:00')

    const { unmount } = renderToday(`/today?date=${getLocalDateString()}`)
    expect(screen.getByRole('img', { name: /^now /i })).toBeInTheDocument()
    unmount()

    renderToday('/today?date=2000-01-14')
    expect(screen.queryByRole('img', { name: /^now /i })).toBeNull()
  })

  it('offers one Generate inside the Day rail when the day has no plan', () => {
    mockPlan({ plan: null })

    renderToday('/today?date=2026-11-06')

    const railSection = screen.getByRole('heading', { name: 'Day rail' }).closest('section')
    expect(railSection).not.toBeNull()
    expect(
      within(railSection as HTMLElement).getAllByRole('button', { name: /generate/i }),
    ).toHaveLength(1)
    expect(screen.getAllByRole('button', { name: /generate/i })).toHaveLength(1)
  })

  it('offers Generate, an empty rail, and no plan health without a plan', () => {
    mockPlan({ plan: null })

    renderToday('/today?date=2026-11-06')

    expect(screen.getByRole('button', { name: /generate/i })).toBeInTheDocument()
    expect(screen.getByText('No Daily plan yet')).toBeInTheDocument()
    expect(screen.queryByText(/plan health/i)).toBeNull()

    const strip = screen.getByRole('region', { name: /today at a glance/i })
    expect(strip).toHaveTextContent(/planned focus/i)
    expect(strip).toHaveTextContent(/—/)
  })

  it('shows the stats and the rail, and offers Regenerate and Re-plan until an outcome exists', () => {
    mockPlan({ plan: railTestPlan, hasPlan: true })

    renderToday(`/today?date=${getLocalDateString()}`)

    const strip = screen.getByRole('region', { name: /today at a glance/i })
    expect(strip).toHaveTextContent(/planned focus/i)
    expect(strip).toHaveTextContent('50m')

    expect(
      screen.getByRole('list', { name: /daily plan blocks/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /regenerate/i }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^re-plan$/i })).toBeInTheDocument()
  })

  it('offers Re-plan once an outcome is recorded', () => {
    mockPlan({ plan: progressPlan, hasPlan: true })

    renderToday(`/today?date=${getLocalDateString()}`)

    expect(screen.getByRole('button', { name: /^re-plan$/i })).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /regenerate/i }),
    ).toBeNull()
  })

  it('renders the agenda instead of the rail below 768px', () => {
    mockPlan({ plan: railTestPlan, hasPlan: true })
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 500,
    })

    renderToday(`/today?date=${getLocalDateString()}`)

    expect(
      screen.queryByRole('list', { name: /daily plan blocks/i }),
    ).toBeNull()
    expect(
      screen.getByRole('heading', { level: 3, name: '09:00' }),
    ).toBeInTheDocument()
  })

  it('opens the outcome dialog for a selected recordable block', () => {
    mockPlan({ plan: railTestPlan, hasPlan: true })

    renderToday(`/today?date=${getLocalDateString()}`)

    fireEvent.click(
      screen.getByRole('button', { name: /write report.*record outcome/i }),
    )

    const dialog = screen.getByRole('dialog', { name: /outcome dialog/i })
    expect(dialog).toHaveTextContent('Write report')

    fireEvent.click(screen.getByRole('button', { name: /close outcome/i }))
    expect(
      screen.queryByRole('dialog', { name: /outcome dialog/i }),
    ).not.toBeInTheDocument()
  })

  it('shows the regenerate prompt once the plan inputs change', () => {
    mockPlan({ plan: railTestPlan, hasPlan: true })
    markRegeneratePromptNeeded()

    try {
      renderToday(`/today?date=${getLocalDateString()}`)

      expect(
        screen.getByText(/regenerate to apply changes/i),
      ).toBeInTheDocument()
    } finally {
      clearRegeneratePrompt()
    }
  })

  it('steps back a day from the date arrow', () => {
    mockPlan({ plan: railTestPlan, hasPlan: true })

    renderToday('/today?date=2026-11-06')

    fireEvent.click(
      screen.getByRole('button', { name: /previous day: 5 Nov 2026/i }),
    )

    expect(screen.getByTestId('location').textContent).toBe('?date=2026-11-05')
  })

  it('steps forward a day from the date arrow', () => {
    mockPlan({ plan: railTestPlan, hasPlan: true })

    renderToday('/today?date=2000-01-14')

    fireEvent.click(screen.getByRole('button', { name: /next day: 15 jan 2000/i }))

    expect(screen.getByTestId('location').textContent).toBe('?date=2000-01-15')
  })

  it('offers Back to today only on a day other than today', () => {
    mockPlan({ plan: railTestPlan, hasPlan: true })

    renderToday(`/today?date=${getLocalDateString()}`)
    expect(screen.queryByRole('button', { name: 'Back to today' })).not.toBeInTheDocument()
  })

  it('makes a past day read-only: no outcome button, no commitment adds, and work sessions', () => {
    mockPlan({ plan: railTestPlan, hasPlan: true })

    renderToday('/today?date=2000-01-14')

    expect(
      screen.queryByRole('button', { name: /write report.*record outcome/i }),
    ).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Work sessions' })).toBeInTheDocument()
  })

  it('returns to today from Back to today', () => {
    mockPlan({ plan: railTestPlan, hasPlan: true })

    renderToday('/today?date=2000-01-14')
    fireEvent.click(screen.getByRole('button', { name: 'Back to today' }))

    expect(screen.getByTestId('location').textContent).toBe(
      `?date=${getLocalDateString()}`,
    )
  })

  it('renders the Commitments panel for the viewed date', () => {
    mockPlan({ plan: null })

    renderToday('/today?date=2099-11-06')

    expect(screen.getByRole('heading', { name: 'Commitments' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^add$/i })).toBeInTheDocument()
    expect(screen.getByText('No Commitments today')).toBeInTheDocument()
    expect(screen.queryByText(/fixed-time blocks/i)).toBeNull()
  })
})

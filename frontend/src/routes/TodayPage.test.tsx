import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { screen, waitFor } from '@testing-library/dom'
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

import { usePlanByDate } from '@/features/plans/hooks'
import {
  clearRegeneratePrompt,
  markRegeneratePromptNeeded,
} from '@/features/plans/regeneratePrompt'
import { progressPlan } from '@/features/plans/planFixtures'
import { railTestPlan } from '@/features/plans/railFixtures'
import { getLocalDateString } from '@/lib/planningDate'
import { TodayPage } from '@/routes/TodayPage'

const mockedUsePlanByDate = vi.mocked(usePlanByDate)

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

  it('renders the Commitments panel for the viewed date', () => {
    mockPlan({ plan: null })

    renderToday('/today?date=2026-11-06')

    expect(screen.getByRole('heading', { name: 'Commitments' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^add$/i })).toBeInTheDocument()
    expect(screen.getByText('No Commitments today')).toBeInTheDocument()
    expect(screen.queryByText(/fixed-time blocks/i)).toBeNull()
  })
})

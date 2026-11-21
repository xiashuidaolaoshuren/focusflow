import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { fireEvent, screen, waitFor } from '@testing-library/dom'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { plansListQueryPrefix } from '@/lib/query'
import { samplePlan } from '@/features/plans/planFixtures'
import { PlanDetailPage } from '@/routes/PlanDetailPage'
import { ApiError } from '@/lib/api'
import type { DailyPlanSummaryResponse, PageResponse } from '@/types/api'

vi.mock('@/features/plans/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/plans/hooks')>()
  return {
    ...actual,
    usePlan: vi.fn(),
    useDeletePlan: vi.fn(),
  }
})

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
  },
}))

import { useDeletePlan, usePlan } from '@/features/plans/hooks'

const mockedUsePlan = vi.mocked(usePlan)
const mockedUseDeletePlan = vi.mocked(useDeletePlan)

const cachedSummary: DailyPlanSummaryResponse = {
  id: 1,
  planDate: '2026-06-14',
  createdAt: '2026-06-14T09:00:00Z',
  scheduledWorkMinutes: 45,
  workSessionCount: 1,
  scheduledTaskCount: 1,
  unplacedWorkCount: 0,
  hasWarning: false,
  hasShortfall: false,
  hasProgress: false,
  needsRefresh: false,
}

function renderPlanDetailPage(options?: {
  initialEntry?: string
  seedHistoryCache?: boolean
}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  if (options?.seedHistoryCache) {
    const page: PageResponse<DailyPlanSummaryResponse> = {
      content: [cachedSummary],
      page: 0,
      size: 20,
      totalElements: 1,
      totalPages: 1,
    }
    queryClient.setQueryData([...plansListQueryPrefix, 0, 20], page)
  }

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[options?.initialEntry ?? '/plans/1']}>
        <Routes>
          <Route path="/dashboard" element={<h1>Dashboard</h1>} />
          <Route path="/plans" element={<h1>Plans</h1>} />
          <Route path="/plans/:id" element={<PlanDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('PlanDetailPage', () => {
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
    mockedUsePlan.mockReturnValue({
      plan: samplePlan,
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof usePlan>)
    mockedUseDeletePlan.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useDeletePlan>)
  })

  it('deletes plan after confirmation and navigates to plan history', async () => {
    const deleteMutate = vi.fn(
      (_id: number, options?: { onSuccess?: () => void }) => {
        options?.onSuccess?.()
      },
    )
    mockedUseDeletePlan.mockReturnValue({
      mutate: deleteMutate,
      isPending: false,
    } as unknown as ReturnType<typeof useDeletePlan>)

    renderPlanDetailPage()

    fireEvent.click(screen.getByRole('button', { name: /^delete plan$/i }))

    expect(deleteMutate).not.toHaveBeenCalled()
    expect(
      screen.getByRole('alertdialog', { name: /delete plan/i }),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /^delete plan$/i }))

    expect(deleteMutate).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    )

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 1, name: 'Plans' }),
      ).toBeInTheDocument()
    })
  })

  it('shows the revision selector and can inspect an earlier revision', () => {
    mockedUsePlan.mockReturnValue({
      plan: {
        ...samplePlan,
        revisions: [
          {
            ...samplePlan.revisions[0]!,
            blocks: [
              {
                ...samplePlan.revisions[0]!.blocks[0]!,
                id: 601,
                startTime: '16:00:00',
                endTime: '16:30:00',
                displayState: 'SUPERSEDED',
              },
            ],
          },
          { ...samplePlan.revisions[0]!, id: 2, revisionNumber: 2 },
        ],
      },
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof usePlan>)

    renderPlanDetailPage()

    fireEvent.click(screen.getByRole('radio', { name: /rev 1/i }))

    expect(
      screen.getByLabelText(/work: write tests, 16:00–16:30/i),
    ).toBeInTheDocument()
  })

  it('marks the day rail Read-only for the current view and for Rev 1', () => {
    mockedUsePlan.mockReturnValue({
      plan: {
        ...samplePlan,
        revisions: [
          { ...samplePlan.revisions[0]!, id: 1, revisionNumber: 1 },
          { ...samplePlan.revisions[0]!, id: 2, revisionNumber: 2 },
        ],
      },
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof usePlan>)

    renderPlanDetailPage()

    expect(screen.getByText('Read-only')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('radio', { name: /rev 1/i }))

    expect(screen.getByText('Read-only')).toBeInTheDocument()
  })

  it('renders the selected revision read-only with no record or add controls', () => {
    renderPlanDetailPage()

    expect(screen.getByRole('list', { name: /daily plan blocks/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /record outcome/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /add unplanned work/i })).toBeNull()
  })

  it('titles the page with the plan date and shows focus, sessions and saved time', () => {
    renderPlanDetailPage()

    expect(screen.getByRole('heading', { level: 1, name: '15 Jun 2026' })).toBeInTheDocument()
    expect(screen.getByText(/^Focus/)).toHaveTextContent(/Sessions/)
  })

  it('shows Unplanned work and Unplaced work cards beside the rail', () => {
    renderPlanDetailPage()

    expect(screen.getByRole('heading', { name: 'Unplanned work' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Unplaced work' })).toBeInTheDocument()
  })

  it('lists work sessions for the selected revision in their groups', () => {
    renderPlanDetailPage()

    expect(screen.getByRole('heading', { name: /work sessions/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /not recorded/i })).toBeInTheDocument()
  })

  it('links to the cached planning date when a stale plan id returns 404', () => {
    mockedUsePlan.mockReturnValue({
      plan: null,
      isPending: false,
      isError: true,
      error: new ApiError({ status: 404, message: 'daily plan not found' }),
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof usePlan>)

    renderPlanDetailPage({ seedHistoryCache: true })

    const recoveryLink = screen.getByRole('link', {
      name: /back to plan for 14 jun 2026/i,
    })
    expect(recoveryLink).toHaveAttribute('href', '/today?date=2026-06-14')
  })

  it('links to plan history when a 404 has no cached summary', () => {
    mockedUsePlan.mockReturnValue({
      plan: null,
      isPending: false,
      isError: true,
      error: new ApiError({ status: 404, message: 'daily plan not found' }),
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof usePlan>)

    renderPlanDetailPage()

    const recoveryLink = screen.getByRole('link', {
      name: /back to plan history/i,
    })
    expect(recoveryLink).toHaveAttribute('href', '/plans')
  })
})

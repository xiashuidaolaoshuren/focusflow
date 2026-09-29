import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { plansListQueryPrefix } from '@/features/plans/hooks'
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
          <Route path="/plans" element={<h1>Plan history</h1>} />
          <Route path="/plans/:id" element={<PlanDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('PlanDetailPage', () => {
  beforeEach(() => {
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
        screen.getByRole('heading', { name: /plan history/i }),
      ).toBeInTheDocument()
    })
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
      name: /back to plan for 2026-06-14/i,
    })
    expect(recoveryLink).toHaveAttribute('href', '/dashboard?date=2026-06-14')
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

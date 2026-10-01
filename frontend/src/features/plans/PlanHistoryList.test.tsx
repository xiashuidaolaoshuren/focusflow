import type { ComponentProps } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { PlanHistoryList } from '@/features/plans/PlanHistoryList'
import { samplePlanSummary } from '@/features/plans/planFixtures'
import type { DailyPlanSummaryResponse } from '@/types/api'

vi.mock('@/features/plans/hooks', () => ({
  useDeletePlan: vi.fn(),
}))

import { useDeletePlan } from '@/features/plans/hooks'

const mockedUseDeletePlan = vi.mocked(useDeletePlan)

const samplePlans: DailyPlanSummaryResponse[] = [
  samplePlanSummary,
  {
    id: 2,
    planDate: '2026-06-15',
    createdAt: '2026-06-15T09:00:00Z',
    scheduledWorkMinutes: 0,
    workSessionCount: 0,
    scheduledTaskCount: 0,
    unplacedWorkCount: 0,
    hasWarning: false,
  },
]

function renderPlanHistoryList(
  props: Partial<ComponentProps<typeof PlanHistoryList>> = {},
) {
  const defaultProps = {
    plans: samplePlans,
    page: 0,
    size: 20,
    totalPages: 3,
    totalElements: 42,
    hasPrevious: false,
    hasNext: true,
    onPageChange: vi.fn(),
    isLoading: false,
    isError: false,
    onRetry: vi.fn(),
  }

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <PlanHistoryList {...defaultProps} {...props} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('PlanHistoryList', () => {
  beforeEach(() => {
    mockedUseDeletePlan.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useDeletePlan>)
  })

  it('renders summary counts instead of legacy item count', () => {
    renderPlanHistoryList()

    const links = screen.getAllByRole('link')
    expect(links[0]).toHaveAttribute('href', '/plans/1')
    expect(links[0]).toHaveTextContent('2026-06-14')
    expect(links[0]).toHaveTextContent('120 min')
    expect(links[0]).toHaveTextContent('3 sessions')
    expect(links[0]).toHaveTextContent('2 tasks')
    expect(links[0]).toHaveTextContent('1 unplaced')
    expect(links[0]).not.toHaveTextContent(/block/i)
  })

  it('shows a Shortfall indicator only for plans with hasWarning', () => {
    renderPlanHistoryList()

    const links = screen.getAllByRole('link')
    expect(links[0]).toHaveTextContent(/shortfall/i)
    expect(links[1]).not.toHaveTextContent(/shortfall/i)
  })

  it('renders empty-state message when plans is empty', () => {
    renderPlanHistoryList({ plans: [] })

    expect(screen.getByText(/no saved plans yet/i)).toBeInTheDocument()
  })

  it('renders empty-state CTA link to dashboard', () => {
    renderPlanHistoryList({ plans: [] })

    const dashboardLink = screen.getByRole('link', { name: /go to dashboard/i })
    expect(dashboardLink).toHaveAttribute('href', '/dashboard')
  })

  it('renders error alert with retry when isError', () => {
    const onRetry = vi.fn()
    renderPlanHistoryList({ isError: true, onRetry })

    expect(screen.getByRole('alert')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /retry/i }))
    expect(onRetry).toHaveBeenCalled()
  })

  it('disables Previous when hasPrevious is false and Next when hasNext is false', () => {
    renderPlanHistoryList({ hasPrevious: false, hasNext: false, page: 2, totalPages: 3 })

    expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /next/i })).toBeDisabled()
  })

  it('calls onPageChange when pagination buttons are clicked', () => {
    const onPageChange = vi.fn()
    renderPlanHistoryList({
      hasPrevious: true,
      hasNext: true,
      page: 1,
      totalPages: 3,
      onPageChange,
    })

    fireEvent.click(screen.getByRole('button', { name: /previous/i }))
    expect(onPageChange).toHaveBeenCalledWith(0)

    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    expect(onPageChange).toHaveBeenCalledWith(2)
  })

  it('shows current page position', () => {
    renderPlanHistoryList({ page: 1, totalPages: 3 })

    expect(screen.getByText(/page 2 of 3/i)).toBeInTheDocument()
  })

  it('calls delete mutation only after confirmation', async () => {
    const deleteMutate = vi.fn()
    mockedUseDeletePlan.mockReturnValue({
      mutate: deleteMutate,
      isPending: false,
    } as unknown as ReturnType<typeof useDeletePlan>)

    renderPlanHistoryList()

    fireEvent.click(
      screen.getByRole('button', { name: /delete plan for 2026-06-14/i }),
    )

    expect(deleteMutate).not.toHaveBeenCalled()
    expect(
      screen.getByRole('alertdialog', { name: /delete plan/i }),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /^delete plan$/i }))
    expect(deleteMutate).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    )
  })
})

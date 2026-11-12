import type { ComponentProps } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { fireEvent, screen, within } from '@testing-library/dom'
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
    hasProgress: false,
    needsRefresh: false,
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

  it('renders a table row per plan with a formatted date link and focus duration', () => {
    renderPlanHistoryList()

    const link = screen.getByRole('link', { name: '14 Jun 2026' })
    expect(link).toHaveAttribute('href', '/plans/1')
    const row = link.closest('tr')!
    expect(within(row).getByText('2h')).toBeInTheDocument()
    expect(within(row).getByText('3')).toBeInTheDocument()
  })

  it('shows each status as a badge with a glyph and its text', () => {
    renderPlanHistoryList({
      plans: [{ ...samplePlanSummary, hasWarning: true, hasProgress: true, needsRefresh: true }],
    })

    const row = screen.getByRole('link', { name: '14 Jun 2026' }).closest('tr')!
    for (const label of ['Shortfall', 'Progress', 'Needs refresh']) {
      expect(within(row).getByText(label).querySelector('svg')).not.toBeNull()
    }
  })

  it('shows a dash in the status cell when a plan has no flags', () => {
    renderPlanHistoryList({
      plans: [{ ...samplePlanSummary, hasWarning: false, hasProgress: false, needsRefresh: false }],
    })

    const row = screen.getByRole('link', { name: '14 Jun 2026' }).closest('tr')!
    expect(within(row).getByText('—')).toBeInTheDocument()
    expect(within(row).queryByText(/shortfall|progress|needs refresh/i)).toBeNull()
  })

  it('renders empty-state message when plans is empty', () => {
    renderPlanHistoryList({ plans: [] })

    expect(screen.getByText(/no saved plans yet/i)).toBeInTheDocument()
  })

  it('renders empty-state CTA link to Today', () => {
    renderPlanHistoryList({ plans: [] })

    const todayLink = screen.getByRole('link', { name: /go to today/i })
    expect(todayLink).toHaveAttribute('href', '/today')
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

  it('shows the visible range and total', () => {
    renderPlanHistoryList({ page: 1, totalPages: 3, totalElements: 42 })

    expect(screen.getByText('21–22')).toBeInTheDocument()
    expect(screen.getByText('42')).toBeInTheDocument()
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

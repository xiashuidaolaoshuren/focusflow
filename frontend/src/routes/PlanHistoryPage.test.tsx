import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { samplePlanSummary } from '@/features/plans/planFixtures'
import { PlanHistoryPage } from '@/routes/PlanHistoryPage'
import type { DailyPlanSummaryResponse, PageResponse } from '@/types/api'

vi.mock('@/features/plans/hooks', () => ({
  usePlans: vi.fn(),
  useDeletePlan: vi.fn(() => ({
    mutate: vi.fn(),
    isPending: false,
  })),
}))

import { usePlans } from '@/features/plans/hooks'

const mockedUsePlans = vi.mocked(usePlans)

const sampleSummary: DailyPlanSummaryResponse = samplePlanSummary

const samplePage: PageResponse<DailyPlanSummaryResponse> = {
  content: [sampleSummary],
  page: 0,
  size: 20,
  totalElements: 42,
  totalPages: 3,
}

describe('PlanHistoryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads the first page with default size on mount', () => {
    mockedUsePlans.mockReturnValue({
      plans: [sampleSummary],
      page: samplePage,
      isPending: false,
      isError: false,
      isEmpty: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof usePlans>)

    render(
      <MemoryRouter>
        <PlanHistoryPage />
      </MemoryRouter>,
    )

    expect(mockedUsePlans).toHaveBeenCalledWith(0, 20)
    expect(screen.getByText('2026-06-14')).toBeInTheDocument()
  })

  it('requests the next page when pagination changes', () => {
    mockedUsePlans.mockImplementation((page: number, size: number) => {
      const pageData: PageResponse<DailyPlanSummaryResponse> = {
        content: [sampleSummary],
        page,
        size,
        totalElements: 42,
        totalPages: 3,
      }

      return {
        plans: pageData.content,
        page: pageData,
        isPending: false,
        isError: false,
        isEmpty: false,
        refetch: vi.fn(),
      } as unknown as ReturnType<typeof usePlans>
    })

    render(
      <MemoryRouter>
        <PlanHistoryPage />
      </MemoryRouter>,
    )

    expect(mockedUsePlans).toHaveBeenCalledWith(0, 20)

    fireEvent.click(screen.getByRole('button', { name: /next/i }))

    expect(mockedUsePlans).toHaveBeenCalledWith(1, 20)
  })
})

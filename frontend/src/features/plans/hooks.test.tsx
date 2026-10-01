import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { samplePlan, samplePlanSummary } from '@/features/plans/planFixtures'
import type { DailyPlanSummaryResponse, PageResponse } from '@/types/api'

import {
  planByDateQueryKey,
  planDetailQueryKey,
  plansQueryKey,
  useDeletePlan,
  useGeneratePlan,
  usePlan,
  usePlanByDate,
  usePlans,
} from '@/features/plans/hooks'
import { markRegeneratePromptNeeded, useRegeneratePrompt } from '@/features/plans/regeneratePrompt'

vi.mock('@/features/plans/api', () => ({
  deletePlan: vi.fn(),
  generateDailyPlan: vi.fn(),
  getPlanByDate: vi.fn(),
  getPlanById: vi.fn(),
  listPlans: vi.fn(),
}))

import {
  deletePlan,
  generateDailyPlan,
  getPlanByDate,
  getPlanById,
  listPlans,
} from '@/features/plans/api'

const mockedDeletePlan = vi.mocked(deletePlan)
const mockedGenerateDailyPlan = vi.mocked(generateDailyPlan)
const mockedGetPlanByDate = vi.mocked(getPlanByDate)
const mockedGetPlanById = vi.mocked(getPlanById)
const mockedListPlans = vi.mocked(listPlans)

function createWrapper(queryClient?: QueryClient) {
  const client =
    queryClient ??
    new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    )
  }
}

const sampleSummary: DailyPlanSummaryResponse = {
  ...samplePlanSummary,
  planDate: '2026-06-15',
  createdAt: '2026-06-15T09:00:00Z',
  hasWarning: false,
}

const samplePage: PageResponse<DailyPlanSummaryResponse> = {
  content: [sampleSummary],
  page: 0,
  size: 20,
  totalElements: 1,
  totalPages: 1,
}

const samplePlanResponse = samplePlan

describe('useGeneratePlan', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('calls generateDailyPlan and refreshes plan-by-date query on success', async () => {
    mockedGenerateDailyPlan.mockResolvedValue(samplePlanResponse)

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    const setQueryDataSpy = vi.spyOn(queryClient, 'setQueryData')

    const { result } = renderHook(() => useGeneratePlan(), {
      wrapper: createWrapper(queryClient),
    })

    result.current.mutate({ planDate: '2026-06-15' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockedGenerateDailyPlan).toHaveBeenCalledWith({
      planDate: '2026-06-15',
    })
    expect(setQueryDataSpy).toHaveBeenCalledWith(
      planByDateQueryKey('2026-06-15'),
      samplePlanResponse,
    )
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: planByDateQueryKey('2026-06-15'),
    })
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['plans', 'list'],
    })
  })

  it('clears the regenerate prompt on generate success', async () => {
    mockedGenerateDailyPlan.mockResolvedValue(samplePlanResponse)
    markRegeneratePromptNeeded()

    const { result } = renderHook(() => useRegeneratePrompt(), {
      wrapper: createWrapper(),
    })

    expect(result.current.needed).toBe(true)

    const generate = renderHook(() => useGeneratePlan(), {
      wrapper: createWrapper(),
    })

    generate.result.current.mutate({ planDate: '2026-06-15' })

    await waitFor(() => expect(generate.result.current.isSuccess).toBe(true))
    await waitFor(() => expect(result.current.needed).toBe(false))
  })
})

describe('usePlanByDate', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('uses a date-scoped query key', () => {
    expect(planByDateQueryKey('2026-06-16')).toEqual([
      'plans',
      'by-date',
      '2026-06-16',
    ])
  })

  it('returns the plan when the query succeeds', async () => {
    mockedGetPlanByDate.mockResolvedValue(samplePlanResponse)

    const { result } = renderHook(() => usePlanByDate('2026-06-15'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockedGetPlanByDate).toHaveBeenCalledWith('2026-06-15')
    expect(result.current.plan).toEqual(samplePlanResponse)
    expect(result.current.hasPlan).toBe(true)
  })

  it('returns null plan state when no plan exists for the date', async () => {
    mockedGetPlanByDate.mockResolvedValue(null)

    const { result } = renderHook(() => usePlanByDate('2026-06-15'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.plan).toBeNull()
    expect(result.current.hasPlan).toBe(false)
  })
})

describe('usePlans', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('uses a paged query key', () => {
    expect(plansQueryKey(0, 20)).toEqual(['plans', 'list', 0, 20])
  })

  it('fetches plans on mount and exposes plans, page envelope, and isEmpty', async () => {
    mockedListPlans.mockResolvedValue(samplePage)

    const { result } = renderHook(() => usePlans(0, 20), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockedListPlans).toHaveBeenCalledWith(0, 20)
    expect(result.current.plans).toEqual([sampleSummary])
    expect(result.current.page).toEqual(samplePage)
    expect(result.current.isEmpty).toBe(false)
  })

  it('exposes isEmpty when no plans are returned', async () => {
    mockedListPlans.mockResolvedValue({
      content: [],
      page: 0,
      size: 20,
      totalElements: 0,
      totalPages: 0,
    })

    const { result } = renderHook(() => usePlans(0, 20), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.plans).toEqual([])
    expect(result.current.isEmpty).toBe(true)
  })
})

describe('usePlan', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('fetches plan detail by id and exposes plan', async () => {
    mockedGetPlanById.mockResolvedValue(samplePlanResponse)

    const { result } = renderHook(() => usePlan(1), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockedGetPlanById).toHaveBeenCalledWith(1)
    expect(result.current.plan).toEqual(samplePlanResponse)
  })

  it('does not fetch when id is invalid', () => {
    renderHook(() => usePlan(Number.NaN), {
      wrapper: createWrapper(),
    })

    expect(mockedGetPlanById).not.toHaveBeenCalled()
  })
})

describe('useDeletePlan', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('calls deletePlan and invalidates plan queries on success', async () => {
    mockedDeletePlan.mockResolvedValue(undefined)

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useDeletePlan(), {
      wrapper: createWrapper(queryClient),
    })

    result.current.mutate(1)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockedDeletePlan).toHaveBeenCalledWith(1)
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['plans', 'by-date'],
    })
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['plans', 'list'],
    })
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: planDetailQueryKey(1),
    })
  })
})

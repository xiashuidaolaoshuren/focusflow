import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/lib/api'
import { GeneratePlanCard } from '@/features/plans/GeneratePlanCard'

vi.mock('@/features/plans/hooks', () => ({
  useGeneratePlan: vi.fn(),
}))

vi.mock('@/features/plans/api', () => ({
  getPlanByDate: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
  },
}))

import { getPlanByDate } from '@/features/plans/api'
import { useGeneratePlan } from '@/features/plans/hooks'
import { toast } from 'sonner'

const mockedUseGeneratePlan = vi.mocked(useGeneratePlan)
const mockedGetPlanByDate = vi.mocked(getPlanByDate)
const mockedToastSuccess = vi.mocked(toast.success)

function renderGeneratePlanCard(planDate = '2026-06-16') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  const view = render(
    <QueryClientProvider client={queryClient}>
      <GeneratePlanCard planDate={planDate} />
    </QueryClientProvider>,
  )

  return {
    ...view,
    rerenderCard: () =>
      view.rerender(
        <QueryClientProvider client={queryClient}>
          <GeneratePlanCard planDate={planDate} />
        </QueryClientProvider>,
      ),
  }
}

describe('GeneratePlanCard', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('submits planDate without available minutes and disables generate while pending', () => {
    const mutate = vi.fn()
    mockedUseGeneratePlan.mockReturnValue({
      mutate,
      isPending: false,
      isError: false,
      error: null,
      reset: vi.fn(),
    } as unknown as ReturnType<typeof useGeneratePlan>)

    const { rerenderCard } = renderGeneratePlanCard('2026-06-16')

    expect(
      screen.queryByLabelText(/available focus time/i),
    ).not.toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', { name: /generate plan for 2026-06-16/i }),
    )

    expect(mutate).toHaveBeenCalledWith(
      { planDate: '2026-06-16' },
      expect.objectContaining({
        onSuccess: expect.any(Function),
        onError: expect.any(Function),
      }),
    )

    mockedUseGeneratePlan.mockReturnValue({
      mutate,
      isPending: true,
      isError: false,
      error: null,
      reset: vi.fn(),
    } as unknown as ReturnType<typeof useGeneratePlan>)

    rerenderCard()

    expect(screen.getByRole('button', { name: /generating/i })).toBeDisabled()
  })

  it('refetches by-date and confirms replace on PLAN_EXISTS', async () => {
    const reset = vi.fn()
    const mutate = vi.fn(
      async (
        payload: { planDate: string; replacePlanId?: number },
        options?: {
          onError?: (error: Error) => void | Promise<void>
          onSuccess?: () => void
        },
      ) => {
        if (payload.replacePlanId == null) {
          await options?.onError?.(
            new ApiError({
              status: 409,
              message: 'plan already exists',
              code: 'PLAN_EXISTS',
            }),
          )
          return
        }

        options?.onSuccess?.()
      },
    )

    mockedUseGeneratePlan.mockReturnValue({
      mutate,
      isPending: false,
      isError: false,
      error: null,
      reset,
    } as unknown as ReturnType<typeof useGeneratePlan>)
    mockedGetPlanByDate.mockResolvedValue({
      id: 5,
      planDate: '2026-06-16',
      createdAt: '2026-06-16T09:00:00Z',
      availableMinutes: null,
      warning: null,
      items: [],
    })

    renderGeneratePlanCard('2026-06-16')

    fireEvent.click(
      screen.getByRole('button', { name: /generate plan for 2026-06-16/i }),
    )

    await waitFor(() => {
      expect(mockedGetPlanByDate).toHaveBeenCalledWith('2026-06-16')
    })
    expect(screen.getByText(/replace existing plan\?/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /replace plan/i }))

    expect(mutate).toHaveBeenLastCalledWith(
      { planDate: '2026-06-16', replacePlanId: 5 },
      expect.objectContaining({
        onSuccess: expect.any(Function),
        onError: expect.any(Function),
      }),
    )
  })

  it('offers a fresh create when refetch finds no plan after PLAN_CHANGED', async () => {
    const mutate = vi.fn(
      async (
        payload: { planDate: string; replacePlanId?: number },
        options?: {
          onError?: (error: Error) => void | Promise<void>
          onSuccess?: () => void
        },
      ) => {
        if (payload.replacePlanId == null) {
          await options?.onError?.(
            new ApiError({
              status: 409,
              message: 'plan changed',
              code: 'PLAN_CHANGED',
            }),
          )
          return
        }

        options?.onSuccess?.()
      },
    )

    mockedUseGeneratePlan.mockReturnValue({
      mutate,
      isPending: false,
      isError: false,
      error: null,
      reset: vi.fn(),
    } as unknown as ReturnType<typeof useGeneratePlan>)
    mockedGetPlanByDate.mockResolvedValue(null)

    renderGeneratePlanCard('2026-06-16')

    fireEvent.click(
      screen.getByRole('button', { name: /generate plan for 2026-06-16/i }),
    )

    await waitFor(() => {
      expect(screen.getByText(/create a fresh plan\?/i)).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /^create plan$/i }))

    expect(mutate).toHaveBeenLastCalledWith(
      { planDate: '2026-06-16' },
      expect.objectContaining({
        onSuccess: expect.any(Function),
        onError: expect.any(Function),
      }),
    )
  })

  it('shows inline provider error for non-conflict failures', () => {
    mockedUseGeneratePlan.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: true,
      error: new ApiError({
        status: 502,
        message: 'provider down',
      }),
      reset: vi.fn(),
    } as unknown as ReturnType<typeof useGeneratePlan>)

    renderGeneratePlanCard()

    expect(screen.getByRole('alert')).toHaveTextContent('provider down')
  })

  it('shows success toast after generate succeeds', () => {
    const mutate = vi.fn(
      (_payload: unknown, options?: { onSuccess?: () => void }) => {
        options?.onSuccess?.()
      },
    )
    mockedUseGeneratePlan.mockReturnValue({
      mutate,
      isPending: false,
      isError: false,
      error: null,
      reset: vi.fn(),
    } as unknown as ReturnType<typeof useGeneratePlan>)

    renderGeneratePlanCard('2026-06-16')

    fireEvent.click(
      screen.getByRole('button', { name: /generate plan for 2026-06-16/i }),
    )

    expect(mockedToastSuccess).toHaveBeenCalledWith(
      'Plan generated for 2026-06-16',
    )
  })
})

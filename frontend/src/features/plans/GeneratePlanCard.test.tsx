import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { samplePlan } from '@/features/plans/planFixtures'
import { progressPlan } from '@/features/plans/planFixtures'
import { GeneratePlanCard } from '@/features/plans/GeneratePlanCard'
import { ApiError } from '@/lib/api'

vi.mock('@/features/plans/hooks', () => ({
  useGeneratePlan: vi.fn(),
  useReplan: vi.fn(),
}))

vi.mock('@/features/tasks/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/tasks/hooks')>()
  return {
    ...actual,
    useTasks: vi.fn(() => ({ tasks: [], isPending: false, isError: false })),
  }
})

vi.mock('@/lib/planningDate', () => ({
  getLocalDateString: vi.fn(() => '2026-06-15'),
  getLocalTimeString: vi.fn(() => '09:45:00'),
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
import { useGeneratePlan, useReplan } from '@/features/plans/hooks'
import { useTasks } from '@/features/tasks/hooks'
import { toast } from 'sonner'
import type { DailyPlanResponse, TaskResponse } from '@/types/api'

const mockedUseGeneratePlan = vi.mocked(useGeneratePlan)
const mockedUseReplan = vi.mocked(useReplan)
const mockedUseTasks = vi.mocked(useTasks)

const liveTask: TaskResponse = {
  id: 10,
  title: 'Write tests',
  description: null,
  priority: 'HIGH',
  status: 'OPEN',
  dueDate: '2026-06-15',
  estimatedMinutes: 60,
  remainingEffortMinutes: 25,
  effortVersion: 2,
  blockedBy: [],
  blocks: [],
}
const mockedGetPlanByDate = vi.mocked(getPlanByDate)
const mockedToastSuccess = vi.mocked(toast.success)

function renderGeneratePlanCard(
  planDate = '2026-06-16',
  plan: DailyPlanResponse | null = null,
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  const view = render(
    <QueryClientProvider client={queryClient}>
      <GeneratePlanCard planDate={planDate} plan={plan} />
    </QueryClientProvider>,
  )

  return {
    ...view,
    rerenderCard: () =>
      view.rerender(
        <QueryClientProvider client={queryClient}>
          <GeneratePlanCard planDate={planDate} plan={plan} />
        </QueryClientProvider>,
      ),
  }
}

describe('GeneratePlanCard re-plan offer', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  function mockHooks() {
    mockedUseGeneratePlan.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
      reset: vi.fn(),
    } as unknown as ReturnType<typeof useGeneratePlan>)
    mockedUseReplan.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useReplan>)
  }

  it('offers re-planning instead of generation for a plan with progress on today', () => {
    mockHooks()

    renderGeneratePlanCard('2026-06-15', { ...progressPlan, planDate: '2026-06-15' })

    expect(
      screen.getByRole('button', { name: /re-plan remaining day/i }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /generate plan for/i }),
    ).not.toBeInTheDocument()
  })

  it('states the cutoff, reloaded commitments, and the focus restart before re-planning', () => {
    mockHooks()

    renderGeneratePlanCard('2026-06-15', { ...progressPlan, planDate: '2026-06-15' })
    fireEvent.click(screen.getByRole('button', { name: /re-plan remaining day/i }))

    const dialog = screen.getByRole('alertdialog', {
      name: /re-plan the remaining day/i,
    })
    expect(dialog).toHaveTextContent(/from 09:45/i)
    expect(dialog).toHaveTextContent(/commitments will be reloaded/i)
    expect(dialog).toHaveTextContent(/focus stretch restarts/i)
    expect(dialog).toHaveTextContent(/without recording a break/i)
  })

  it('explains that only today can be re-planned for a progress plan on another date', () => {
    mockHooks()

    renderGeneratePlanCard('2026-06-14', {
      ...progressPlan,
      planDate: '2026-06-14',
    })

    expect(
      screen.queryByRole('button', { name: /re-plan remaining day/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByText(/only today's plan can be re-planned/i),
    ).toBeInTheDocument()
  })

  it('keeps the generate button for a plan without progress', () => {
    mockHooks()

    renderGeneratePlanCard('2026-06-15', { ...samplePlan, planDate: '2026-06-15' })

    expect(
      screen.getByRole('button', { name: /generate plan for 2026-06-15/i }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /re-plan remaining day/i }),
    ).not.toBeInTheDocument()
  })
})

describe('GeneratePlanCard re-plan submission', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('posts the cutoff, the latest revision, and every plannable task version', () => {
    const replanMutate = vi.fn()
    mockedUseGeneratePlan.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
      reset: vi.fn(),
    } as unknown as ReturnType<typeof useGeneratePlan>)
    mockedUseReplan.mockReturnValue({
      mutate: replanMutate,
      isPending: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useReplan>)
    mockedUseTasks.mockReturnValue({
      tasks: [
        { ...liveTask, id: 10, status: 'OPEN', effortVersion: 2 },
        { ...liveTask, id: 11, status: 'IN_PROGRESS', effortVersion: 0 },
        { ...liveTask, id: 12, status: 'DONE', effortVersion: 5 },
        { ...liveTask, id: 13, status: 'CANCELLED', effortVersion: 1 },
      ],
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useTasks>)

    renderGeneratePlanCard('2026-06-15', { ...progressPlan, planDate: '2026-06-15' })
    fireEvent.click(screen.getByRole('button', { name: /re-plan remaining day/i }))
    fireEvent.click(screen.getByRole('button', { name: /^confirm re-plan$/i }))

    expect(replanMutate).toHaveBeenCalledWith(
      {
        id: progressPlan.id,
        request: {
          currentDate: '2026-06-15',
          cutoff: '09:45:00',
          expectedRevisionId: 1,
          effortVersions: [
            { taskId: 10, effortVersion: 2 },
            { taskId: 11, effortVersion: 0 },
          ],
        },
      },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    )
  })
})

describe('GeneratePlanCard re-plan errors', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  function mockReplanError(error: ApiError) {
    mockedUseGeneratePlan.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
      reset: vi.fn(),
    } as unknown as ReturnType<typeof useGeneratePlan>)
    mockedUseReplan.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: true,
      error,
    } as unknown as ReturnType<typeof useReplan>)
  }

  it('explains that a legacy plan cannot be re-planned', () => {
    mockReplanError(
      new ApiError({
        status: 409,
        message: 'plan has no complete scheduling snapshot',
        code: 'REPLAN_LEGACY_SNAPSHOT',
      }),
    )

    renderGeneratePlanCard('2026-06-15', { ...progressPlan, planDate: '2026-06-15' })

    expect(screen.getByText(/cannot be regenerated/i)).toBeInTheDocument()
    expect(screen.getByText(/keep recording actuals/i)).toBeInTheDocument()
  })

  it('keeps the newer change and explains a PLAN_CHANGED conflict', () => {
    mockReplanError(
      new ApiError({
        status: 409,
        message: 'plan revision has changed',
        code: 'PLAN_CHANGED',
      }),
    )

    renderGeneratePlanCard('2026-06-15', { ...progressPlan, planDate: '2026-06-15' })

    expect(screen.getByText(/newer update was kept/i)).toBeInTheDocument()
  })

  it('tells the user to resolve elapsed work first', () => {
    mockReplanError(
      new ApiError({
        status: 409,
        message: 'elapsed work must be resolved before re-planning',
        code: 'ELAPSED_WORK_UNRESOLVED',
      }),
    )

    renderGeneratePlanCard('2026-06-15', { ...progressPlan, planDate: '2026-06-15' })

    expect(screen.getByText(/resolve the elapsed sessions/i)).toBeInTheDocument()
  })
})

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
      ...samplePlan,
      id: 5,
      planDate: '2026-06-16',
      createdAt: '2026-06-16T09:00:00Z',
      blocks: [],
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

  it('shows the conflict error when the by-date refetch fails', async () => {
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
        }
      },
    )

    mockedUseGeneratePlan.mockReturnValue({
      mutate,
      isPending: false,
      isError: false,
      error: null,
      reset: vi.fn(),
    } as unknown as ReturnType<typeof useGeneratePlan>)
    mockedGetPlanByDate.mockRejectedValue(new Error('refetch failed'))

    renderGeneratePlanCard('2026-06-16')

    fireEvent.click(
      screen.getByRole('button', { name: /generate plan for 2026-06-16/i }),
    )

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/plan already exists/i)
    })
    expect(screen.queryByText(/replace existing plan\?/i)).not.toBeInTheDocument()
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

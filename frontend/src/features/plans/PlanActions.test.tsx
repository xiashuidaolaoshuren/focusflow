import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { fireEvent, screen } from '@testing-library/dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/features/plans/hooks', () => ({
  useGeneratePlan: vi.fn(),
}))

import { ApiError } from '@/lib/api'
import { PlanActions } from '@/features/plans/PlanActions'
import { progressPlan, samplePlan } from '@/features/plans/planFixtures'
import { useGeneratePlan } from '@/features/plans/hooks'

const mockedUseGeneratePlan = vi.mocked(useGeneratePlan)

function mockGenerate(state: {
  mutate?: ReturnType<typeof vi.fn>
  isPending?: boolean
}) {
  mockedUseGeneratePlan.mockReturnValue({
    mutate: state.mutate ?? vi.fn(),
    isPending: state.isPending ?? false,
  } as unknown as ReturnType<typeof useGeneratePlan>)
}

function renderActions(plan: Parameters<typeof PlanActions>[0]['plan']) {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <PlanActions
        plan={plan}
        planDate="2026-06-15"
        today="2026-06-15"
        replan={{ run: vi.fn(), isPending: false, error: null }}
      />
    </QueryClientProvider>,
  )
}

describe('PlanActions', () => {
  beforeEach(() => {
    mockGenerate({})
  })

  it('offers Regenerate and Re-plan on today when nothing is recorded', () => {
    renderActions(samplePlan)

    expect(screen.getByRole('button', { name: /regenerate/i })).toBeInTheDocument()
    const replan = screen.getByRole('button', { name: /^re-plan$/i })
    expect(replan).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^generate$/i })).toBeNull()

    const solid = screen
      .getAllByRole('button')
      .filter((button) => button.className.includes('bg-primary'))
    expect(solid).toEqual([replan])
  })

  it('hides Regenerate once something is recorded', () => {
    renderActions(progressPlan)

    expect(screen.queryByRole('button', { name: /regenerate/i })).toBeNull()
    expect(screen.getByRole('button', { name: /^re-plan$/i })).toBeInTheDocument()
  })

  it('offers nothing on a past day', () => {
    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    })

    render(
      <QueryClientProvider client={queryClient}>
        <PlanActions
          plan={samplePlan}
          planDate="2026-06-14"
          today="2026-06-15"
          replan={{ run: vi.fn(), isPending: false, error: null }}
        />
      </QueryClientProvider>,
    )

    expect(screen.queryByRole('button')).toBeNull()
  })

  it('offers Regenerate but never Re-plan on a future day', () => {
    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    })

    render(
      <QueryClientProvider client={queryClient}>
        <PlanActions
          plan={samplePlan}
          planDate="2026-06-16"
          today="2026-06-15"
          replan={{ run: vi.fn(), isPending: false, error: null }}
        />
      </QueryClientProvider>,
    )

    expect(screen.getByRole('button', { name: /regenerate/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^re-plan$/i })).toBeNull()
  })

  it('runs the re-plan through the shared control', () => {
    const run = vi.fn()
    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    })

    render(
      <QueryClientProvider client={queryClient}>
        <PlanActions
          plan={samplePlan}
          planDate="2026-06-15"
          today="2026-06-15"
          replan={{ run, isPending: false, error: null }}
        />
      </QueryClientProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: /^re-plan$/i }))
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('shows the re-planning state while the request is in flight', () => {
    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    })

    render(
      <QueryClientProvider client={queryClient}>
        <PlanActions
          plan={samplePlan}
          planDate="2026-06-15"
          today="2026-06-15"
          replan={{ run: vi.fn(), isPending: true, error: null }}
        />
      </QueryClientProvider>,
    )

    const replan = screen.getByRole('button', { name: /re-planning/i })
    expect(replan).toBeDisabled()
    expect(replan).toHaveAttribute('aria-busy', 'true')
  })

  it('confirms before regenerating and then names the plan it replaces', () => {
    const mutate = vi.fn()
    mockGenerate({ mutate })

    renderActions(samplePlan)
    fireEvent.click(screen.getByRole('button', { name: /regenerate/i }))

    expect(mutate).not.toHaveBeenCalled()
    const dialog = screen.getByRole('alertdialog', {
      name: /regenerate this day/i,
    })
    expect(dialog).toHaveTextContent(/replaces the current plan/i)

    fireEvent.click(screen.getByRole('button', { name: /^regenerate plan$/i }))

    expect(mutate.mock.calls[0]?.[0]).toEqual({
      planDate: '2026-06-15',
      replacePlanId: samplePlan.id,
    })
  })

  it('leaves the plan alone when the regenerate confirm is cancelled', () => {
    const mutate = vi.fn()
    mockGenerate({ mutate })

    renderActions(samplePlan)
    fireEvent.click(screen.getByRole('button', { name: /regenerate/i }))
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))

    expect(mutate).not.toHaveBeenCalled()
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('treats a plan that gained progress as a conflict too', async () => {
    const mutate = vi.fn(
      (_variables: unknown, options?: { onError?: (error: unknown) => void }) => {
        options?.onError?.(
          new ApiError({
            status: 409,
            code: 'PLAN_HAS_PROGRESS',
            message: 'plan has recorded progress',
          }),
        )
      },
    )
    mockGenerate({ mutate })

    renderActions(samplePlan)
    fireEvent.click(screen.getByRole('button', { name: /regenerate/i }))
    fireEvent.click(screen.getByRole('button', { name: /^regenerate plan$/i }))

    expect(
      await screen.findByText(/a newer update was kept/i),
    ).toBeInTheDocument()
  })

  it('explains a failed re-plan with the server message for its code', () => {
    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    })

    const { rerender } = render(
      <QueryClientProvider client={queryClient}>
        <PlanActions
          plan={samplePlan}
          planDate="2026-06-15"
          today="2026-06-15"
          replan={{
            run: vi.fn(),
            isPending: false,
            error: new ApiError({
              status: 409,
              code: 'REPLAN_LEGACY_SNAPSHOT',
              message: 'plan has no complete scheduling snapshot',
            }),
          }}
        />
      </QueryClientProvider>,
    )

    expect(
      screen.getByText(/original scheduling rules were not captured/i),
    ).toBeInTheDocument()

    rerender(
      <QueryClientProvider client={queryClient}>
        <PlanActions
          plan={samplePlan}
          planDate="2026-06-15"
          today="2026-06-15"
          replan={{
            run: vi.fn(),
            isPending: false,
            error: new ApiError({
              status: 409,
              code: 'ELAPSED_WORK_UNRESOLVED',
              message: 'elapsed work must be resolved',
            }),
          }}
        />
      </QueryClientProvider>,
    )

    expect(
      screen.getByText(/resolve the elapsed sessions first/i),
    ).toBeInTheDocument()
  })

  it('shows nothing extra when the re-plan has not failed', () => {
    renderActions(samplePlan)

    expect(screen.queryByText(/could not re-plan/i)).toBeNull()
    expect(screen.queryByText(/original scheduling rules/i)).toBeNull()
  })
})

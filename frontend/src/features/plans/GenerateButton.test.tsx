import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { fireEvent, screen } from '@testing-library/dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/features/plans/hooks', () => ({
  useGeneratePlan: vi.fn(),
}))

import { GenerateButton } from '@/features/plans/GenerateButton'
import { useGeneratePlan } from '@/features/plans/hooks'
import { ApiError } from '@/lib/api'
import { plansByDateQueryPrefix } from '@/lib/query'

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

function renderButton() {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <GenerateButton planDate="2026-06-15" />
    </QueryClientProvider>,
  )
}

describe('GenerateButton', () => {
  beforeEach(() => {
    mockGenerate({})
  })

  it('generates a plan for the day it is given', () => {
    const mutate = vi.fn()
    mockGenerate({ mutate })

    renderButton()
    fireEvent.click(screen.getByRole('button', { name: /generate/i }))

    expect(mutate.mock.calls[0]?.[0]).toEqual({ planDate: '2026-06-15' })
  })

  it('shows the generating state while the request is in flight', () => {
    mockGenerate({ isPending: true })

    renderButton()

    const generate = screen.getByRole('button', { name: /generating/i })
    expect(generate).toBeDisabled()
    expect(generate).toHaveAttribute('aria-busy', 'true')
  })

  it('refreshes the plan views and says so when the plan changed underneath', async () => {
    const conflict = new ApiError({
      status: 409,
      code: 'PLAN_EXISTS',
      message: 'plan already exists',
    })
    const mutate = vi.fn(
      (_variables: unknown, options?: { onError?: (error: unknown) => void }) => {
        options?.onError?.(conflict)
      },
    )
    mockGenerate({ mutate })
    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    })
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')

    render(
      <QueryClientProvider client={queryClient}>
        <GenerateButton planDate="2026-06-15" />
      </QueryClientProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: /^generate$/i }))

    expect(await screen.findByText(/a newer update was kept/i)).toBeInTheDocument()
    expect(invalidate).toHaveBeenCalledWith({ queryKey: plansByDateQueryPrefix })
  })

  it('explains when no active tasks are available to plan', async () => {
    const mutate = vi.fn(
      (_variables: unknown, options?: { onError?: (error: unknown) => void }) => {
        options?.onError?.(new ApiError({
          status: 400,
          message: 'no plannable tasks available for planning',
        }))
      },
    )
    mockGenerate({ mutate })
    const queryClient = new QueryClient()
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    render(
      <QueryClientProvider client={queryClient}>
        <GenerateButton planDate="2026-06-15" />
      </QueryClientProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: /^generate$/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No active tasks to plan. Add or reopen a task, then try generating again.',
    )
    expect(screen.getByRole('button', { name: /^generate$/i })).toBeEnabled()
    expect(screen.queryByText(/a newer update was kept/i)).toBeNull()
    expect(invalidate).not.toHaveBeenCalled()
  })

  it('clears the no-active-tasks message when retry starts', async () => {
    const mutate = vi.fn()
      .mockImplementationOnce((_variables: unknown, options?: { onError?: (error: unknown) => void }) => {
        options?.onError?.(new ApiError({ status: 400, message: 'no plannable tasks available for planning' }))
      })
      .mockImplementationOnce(() => {})
    mockGenerate({ mutate })
    renderButton()

    fireEvent.click(screen.getByRole('button', { name: /^generate$/i }))
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^generate$/i }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('does not show a previous date’s no-active-tasks message', async () => {
    const mutate = vi.fn((_variables: unknown, options?: { onError?: (error: unknown) => void }) => {
      options?.onError?.(new ApiError({ status: 400, message: 'no plannable tasks available for planning' }))
    })
    mockGenerate({ mutate })
    const client = new QueryClient()
    const { rerender } = render(
      <QueryClientProvider client={client}>
        <GenerateButton planDate="2026-06-15" />
      </QueryClientProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: /^generate$/i }))
    expect(await screen.findByRole('alert')).toBeInTheDocument()

    rerender(
      <QueryClientProvider client={client}>
        <GenerateButton planDate="2026-06-16" />
      </QueryClientProvider>,
    )
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it.each([
    new ApiError({ status: 400, code: 'PLAN_CANDIDATE_LIMIT', message: 'no plannable tasks available for planning' }),
    new ApiError({ status: 400, message: 'invalid date' }),
  ])('does not mislabel another bad request as no active tasks', async (error) => {
    const mutate = vi.fn((_variables: unknown, options?: { onError?: (error: unknown) => void }) => {
      options?.onError?.(error)
    })
    mockGenerate({ mutate })
    renderButton()
    fireEvent.click(screen.getByRole('button', { name: /^generate$/i }))
    expect(screen.queryByText(/no active tasks to plan/i)).not.toBeInTheDocument()
  })

  it('keeps an ordinary failure out of the conflict copy', async () => {
    const mutate = vi.fn(
      (_variables: unknown, options?: { onError?: (error: unknown) => void }) => {
        options?.onError?.(new ApiError({ status: 500, message: 'boom' }))
      },
    )
    mockGenerate({ mutate })

    renderButton()
    fireEvent.click(screen.getByRole('button', { name: /^generate$/i }))

    await Promise.resolve()
    expect(screen.queryByText(/a newer update was kept/i)).toBeNull()
  })
})

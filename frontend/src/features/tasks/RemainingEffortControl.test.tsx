import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { TaskResponse } from '@/types/api'
import { RemainingEffortControl } from '@/features/tasks/RemainingEffortControl'
import { PROGRESS_CONFLICT_MESSAGE } from '@/features/tasks/taskEffortConflict'
import type { UseReassessRemainingEffortOptions } from '@/features/tasks/hooks'

vi.mock('@/features/tasks/hooks', () => ({
  useReassessRemainingEffort: vi.fn(),
}))

vi.mock('@/lib/planningDate', () => ({
  getLocalDateString: vi.fn(() => '2026-06-15'),
}))

import { useReassessRemainingEffort } from '@/features/tasks/hooks'

const mockedUseReassessRemainingEffort = vi.mocked(useReassessRemainingEffort)

const sampleTask: TaskResponse = {
  id: 1,
  title: 'Write report',
  description: null,
  priority: 'HIGH',
  status: 'IN_PROGRESS',
  dueDate: '2026-06-15',
  estimatedMinutes: 60,
  remainingEffortMinutes: 25,
  effortVersion: 2,
  blockedBy: [],
  blocks: [],
}

function renderControl(task = sampleTask) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  render(
    <QueryClientProvider client={queryClient}>
      <RemainingEffortControl task={task} />
    </QueryClientProvider>,
  )
}

describe('RemainingEffortControl', () => {
  it('posts RemainingEffortRequest and explains same-day ordering', () => {
    const mutate = vi.fn()
    mockedUseReassessRemainingEffort.mockReturnValue({
      mutate,
      isPending: false,
    } as unknown as ReturnType<typeof useReassessRemainingEffort>)

    renderControl()

    fireEvent.click(screen.getByRole('button', { name: /reassess remaining effort/i }))
    expect(
      screen.getByText(/work logged later for that same date counts as new progress/i),
    ).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(/remaining effort minutes/i), {
      target: { value: '40' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^save reassessment$/i }))

    expect(mutate).toHaveBeenCalledWith(
      {
        id: 1,
        request: {
          remainingEffortMinutes: 40,
          currentDate: '2026-06-15',
          effortVersion: 2,
        },
      },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    )
  })

  it('closes reassessment dialog and explains PROGRESS_CONFLICT', async () => {
    let hookOptions: UseReassessRemainingEffortOptions | undefined
    mockedUseReassessRemainingEffort.mockImplementation((options) => {
      hookOptions = options
      return {
        mutate: vi.fn(),
        isPending: false,
      } as unknown as ReturnType<typeof useReassessRemainingEffort>
    })

    renderControl()

    fireEvent.click(screen.getByRole('button', { name: /reassess remaining effort/i }))
    expect(
      screen.getByRole('alertdialog', { name: /reassess remaining effort/i }),
    ).toBeInTheDocument()

    await act(async () => {
      hookOptions?.onEffortConflict?.()
    })

    await waitFor(() => {
      expect(
        screen.queryByRole('alertdialog', { name: /reassess remaining effort/i }),
      ).not.toBeInTheDocument()
    })
    expect(screen.getByText(PROGRESS_CONFLICT_MESSAGE)).toBeInTheDocument()
  })
})

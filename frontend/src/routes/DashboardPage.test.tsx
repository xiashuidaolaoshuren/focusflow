import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  clearRegeneratePrompt,
  markRegeneratePromptNeeded,
} from '@/features/plans/regeneratePrompt'
import { DashboardPage } from '@/routes/DashboardPage'

vi.mock('@/features/tasks/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/tasks/hooks')>()
  return {
    ...actual,
    useTasks: vi.fn(),
    useCreateTask: vi.fn(),
    useUpdateTask: vi.fn(),
    useDeleteTask: vi.fn(),
  }
})

vi.mock('@/features/plans/hooks', () => ({
  usePlanByDate: vi.fn(),
  useGeneratePlan: vi.fn(),
}))

vi.mock('@/features/commitments/hooks', () => ({
  useCommitments: vi.fn(() => ({
    commitments: [],
    isPending: false,
    isError: false,
    error: null,
  })),
  useCreateCommitment: vi.fn(() => ({
    mutate: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
  })),
  useUpdateCommitment: vi.fn(() => ({
    mutate: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
  })),
  useDeleteCommitment: vi.fn(() => ({
    mutate: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
  })),
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
  },
}))

import { useCreateTask, useDeleteTask, useTasks, useUpdateTask } from '@/features/tasks/hooks'
import { useGeneratePlan, usePlanByDate } from '@/features/plans/hooks'
import type { DailyPlanResponse } from '@/types/api'

const mockedUseTasks = vi.mocked(useTasks)
const mockedUseCreateTask = vi.mocked(useCreateTask)
const mockedUseUpdateTask = vi.mocked(useUpdateTask)
const mockedUseDeleteTask = vi.mocked(useDeleteTask)
const mockedUsePlanByDate = vi.mocked(usePlanByDate)
const mockedUseGeneratePlan = vi.mocked(useGeneratePlan)

const sampleTask = {
  id: 1,
  title: 'Write report',
  description: 'Quarterly summary',
  priority: 'HIGH' as const,
  status: 'OPEN' as const,
  dueDate: '2026-06-15',
  estimatedMinutes: 60,
}

const samplePlan: DailyPlanResponse = {
  id: 1,
  planDate: '2026-06-15',
  createdAt: '2026-06-15T09:00:00Z',
  availableMinutes: null,
  warning: null,
  items: [
    {
      position: 1,
      task: {
        id: 10,
        title: 'Write tests',
        description: null,
        priority: 'HIGH',
        status: 'OPEN',
        dueDate: '2026-06-15',
        estimatedMinutes: 45,
      },
    },
  ],
}

function renderDashboard(initialEntry = '/dashboard') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  const router = createMemoryRouter(
    [{ path: '/dashboard', element: <DashboardPage /> }],
    { initialEntries: [initialEntry] },
  )

  const view = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )

  return {
    ...view,
    router,
    rerenderDashboard: () =>
      view.rerender(
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
        </QueryClientProvider>,
      ),
  }
}

function mockEmptyTasks() {
  mockedUseTasks.mockReturnValue({
    isPending: false,
    isError: false,
    isEmpty: true,
    tasks: [],
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useTasks>)
}

function mockLoadedTasks() {
  mockedUseTasks.mockReturnValue({
    isPending: false,
    isError: false,
    isEmpty: false,
    tasks: [sampleTask],
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useTasks>)
}

function mockMutations() {
  mockedUseCreateTask.mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
  } as unknown as ReturnType<typeof useCreateTask>)
  mockedUseUpdateTask.mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof useUpdateTask>)
  mockedUseDeleteTask.mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof useDeleteTask>)
}

function mockNoPlan() {
  mockedUsePlanByDate.mockReturnValue({
    isPending: false,
    isError: false,
    plan: null,
    hasPlan: false,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof usePlanByDate>)
  mockedUseGeneratePlan.mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
  } as unknown as ReturnType<typeof useGeneratePlan>)
}

function mockPendingPlan() {
  mockedUsePlanByDate.mockReturnValue({
    isPending: true,
    isError: false,
    plan: null,
    hasPlan: false,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof usePlanByDate>)
  mockedUseGeneratePlan.mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
  } as unknown as ReturnType<typeof useGeneratePlan>)
}

function mockPlanError() {
  mockedUsePlanByDate.mockReturnValue({
    isPending: false,
    isError: true,
    plan: null,
    hasPlan: false,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof usePlanByDate>)
  mockedUseGeneratePlan.mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
  } as unknown as ReturnType<typeof useGeneratePlan>)
}

function mockExistingPlan() {
  mockedUsePlanByDate.mockReturnValue({
    isPending: false,
    isError: false,
    plan: samplePlan,
    hasPlan: true,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof usePlanByDate>)
  mockedUseGeneratePlan.mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
  } as unknown as ReturnType<typeof useGeneratePlan>)
}

describe('DashboardPage', () => {
  afterEach(() => {
    vi.useRealTimers()
    clearRegeneratePrompt()
  })

  it('defaults to the browser-local planning date when no query param is present', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-15T10:00:00'))
    mockEmptyTasks()
    mockMutations()
    mockNoPlan()

    const { router } = renderDashboard('/dashboard')

    expect(mockedUsePlanByDate).toHaveBeenCalledWith('2026-06-15')
    expect(screen.getByLabelText(/planning date/i)).toHaveValue('2026-06-15')
    expect(router.state.location.search).toBe('?date=2026-06-15')
  })

  it('loads the plan for ?date= query param', () => {
    mockEmptyTasks()
    mockMutations()
    mockNoPlan()

    renderDashboard('/dashboard?date=2026-06-16')

    expect(mockedUsePlanByDate).toHaveBeenCalledWith('2026-06-16')
    expect(screen.getByLabelText(/planning date/i)).toHaveValue('2026-06-16')
  })

  it('updates the search param when the planning date changes', () => {
    mockEmptyTasks()
    mockMutations()
    mockNoPlan()

    const { router } = renderDashboard('/dashboard?date=2026-06-16')

    fireEvent.change(screen.getByLabelText(/planning date/i), {
      target: { value: '2026-06-20' },
    })

    expect(router.state.location.search).toBe('?date=2026-06-20')
  })

  it('shows actionable empty-state CTA copy', () => {
    mockEmptyTasks()
    mockMutations()
    mockNoPlan()

    renderDashboard()

    expect(
      screen.getByText(/click new task to create your first one/i),
    ).toBeInTheDocument()
  })

  it('opens the create-task sheet when New Task is clicked', async () => {
    mockEmptyTasks()
    mockMutations()
    mockNoPlan()

    renderDashboard()

    fireEvent.click(screen.getAllByRole('button', { name: /^new task$/i })[0]!)

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })
    expect(
      screen.getByRole('heading', { name: /new task/i }),
    ).toBeInTheDocument()
  })

  it('opens the create-task sheet when empty-state New Task CTA is clicked', async () => {
    mockEmptyTasks()
    mockMutations()
    mockNoPlan()

    renderDashboard()

    const newTaskButtons = screen.getAllByRole('button', { name: /^new task$/i })
    fireEvent.click(newTaskButtons[newTaskButtons.length - 1]!)

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })
    expect(
      screen.getByRole('heading', { name: /new task/i }),
    ).toBeInTheDocument()
  })

  it('closes the sheet after a successful create', async () => {
    mockEmptyTasks()
    mockNoPlan()
    const mutate = vi.fn(
      (_payload: unknown, options?: { onSuccess?: () => void }) => {
        options?.onSuccess?.()
      },
    )
    mockedUseCreateTask.mockReturnValue({
      mutate,
      isPending: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useCreateTask>)
    mockedUseUpdateTask.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useUpdateTask>)
    mockedUseDeleteTask.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useDeleteTask>)

    renderDashboard()

    fireEvent.click(screen.getAllByRole('button', { name: /^new task$/i })[0]!)

    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText(/^title$/i), {
      target: { value: 'Write tests' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: /create task/i }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
    expect(mutate).toHaveBeenCalled()
  })

  it('opens edit sheet with selected task when edit action is clicked', async () => {
    mockLoadedTasks()
    mockMutations()
    mockNoPlan()

    renderDashboard()

    fireEvent.click(screen.getByRole('button', { name: /task actions for write report/i }))
    fireEvent.click(await screen.findByRole('menuitem', { name: /edit/i }))

    const dialog = await screen.findByRole('dialog')
    expect(
      within(dialog).getByRole('heading', { name: /edit task/i }),
    ).toBeInTheDocument()
    expect(within(dialog).getByLabelText(/^title$/i)).toHaveValue('Write report')
  })

  it('triggers status update mutation from quick status control', () => {
    const updateMutate = vi.fn()
    mockLoadedTasks()
    mockMutations()
    mockNoPlan()
    mockedUseUpdateTask.mockReturnValue({
      mutate: updateMutate,
      isPending: false,
    } as unknown as ReturnType<typeof useUpdateTask>)

    renderDashboard()

    fireEvent.change(screen.getByLabelText(/change status for write report/i), {
      target: { value: 'IN_PROGRESS' },
    })

    expect(updateMutate).toHaveBeenCalledWith({
      id: 1,
      request: {
        title: 'Write report',
        description: 'Quarterly summary',
        priority: 'HIGH',
        status: 'IN_PROGRESS',
        dueDate: '2026-06-15',
        estimatedMinutes: 60,
      },
    })
  })

  it('deletes task only after confirmation dialog is accepted', async () => {
    const deleteMutate = vi.fn()
    mockLoadedTasks()
    mockMutations()
    mockNoPlan()
    mockedUseDeleteTask.mockReturnValue({
      mutate: deleteMutate,
      isPending: false,
    } as unknown as ReturnType<typeof useDeleteTask>)

    renderDashboard()

    fireEvent.click(screen.getByRole('button', { name: /task actions for write report/i }))
    fireEvent.click(await screen.findByRole('menuitem', { name: /delete/i }))

    expect(deleteMutate).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /^delete task$/i }))
    expect(deleteMutate).toHaveBeenCalledWith(1)
  })

  it('displays existing today plan on page load', () => {
    mockEmptyTasks()
    mockMutations()
    mockExistingPlan()

    renderDashboard()

    expect(screen.getByText('Write tests')).toBeInTheDocument()
    expect(screen.getByText('45 min')).toBeInTheDocument()
  })

  it('shows plan skeleton while today plan is loading', () => {
    mockEmptyTasks()
    mockMutations()
    mockPendingPlan()

    renderDashboard()

    expect(screen.getByRole('status', { name: /loading plan/i })).toBeInTheDocument()
    expect(screen.queryByText(/no plan for today yet/i)).not.toBeInTheDocument()
  })

  it('shows plan error alert when today plan fails to load', () => {
    mockEmptyTasks()
    mockMutations()
    mockPlanError()

    renderDashboard()

    expect(screen.getByRole('alert')).toHaveTextContent(/could not load plan/i)
  })

  it('submits generate for the selected planning date', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-15T10:00:00'))
    mockEmptyTasks()
    mockMutations()
    mockNoPlan()

    const mutate = vi.fn()
    mockedUseGeneratePlan.mockReturnValue({
      mutate,
      isPending: false,
      isError: false,
      error: null,
      reset: vi.fn(),
    } as unknown as ReturnType<typeof useGeneratePlan>)

    renderDashboard('/dashboard')

    fireEvent.click(
      screen.getByRole('button', { name: /generate plan for 2026-06-15/i }),
    )

    expect(mutate).toHaveBeenCalledWith(
      { planDate: '2026-06-15' },
      expect.objectContaining({
        onSuccess: expect.any(Function),
        onError: expect.any(Function),
      }),
    )
  })

  it('shows regenerate prompt after task edit when a plan exists', async () => {
    mockLoadedTasks()
    mockMutations()
    mockExistingPlan()

    const mutate = vi.fn(
      (_payload: unknown, options?: { onSuccess?: () => void }) => {
        markRegeneratePromptNeeded()
        options?.onSuccess?.()
      },
    )
    mockedUseUpdateTask.mockReturnValue({
      mutate,
      isPending: false,
    } as unknown as ReturnType<typeof useUpdateTask>)

    const { rerenderDashboard } = renderDashboard('/dashboard?date=2026-06-15')

    expect(
      screen.queryByText(/regenerate to apply changes/i),
    ).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(/change status for write report/i), {
      target: { value: 'IN_PROGRESS' },
    })

    rerenderDashboard()

    expect(
      screen.getByText(/regenerate to apply changes/i),
    ).toBeInTheDocument()
  })

  it('does not show regenerate prompt when no plan exists', () => {
    mockLoadedTasks()
    mockMutations()
    mockNoPlan()

    markRegeneratePromptNeeded()

    renderDashboard('/dashboard?date=2026-06-15')

    expect(
      screen.queryByText(/regenerate to apply changes/i),
    ).not.toBeInTheDocument()
  })
})

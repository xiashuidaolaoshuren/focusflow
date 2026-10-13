import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'

import { ApiError } from '@/lib/api'
import type { TaskResponse } from '@/types/api'
import { TaskList } from '@/features/tasks/TaskList'

vi.mock('@/lib/planningDate', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/planningDate')>()
  return {
    ...actual,
    getLocalDateString: vi.fn(() => '2026-06-15'),
  }
})

vi.mock('@/features/tasks/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/tasks/hooks')>()
  return {
    ...actual,
    useTasks: vi.fn(),
    useUpdateTask: vi.fn(),
    useDeleteTask: vi.fn(),
    useReassessRemainingEffort: vi.fn(() => ({
      mutate: vi.fn(),
      isPending: false,
    })),
  }
})

import { useDeleteTask, useTasks, useUpdateTask } from '@/features/tasks/hooks'

const mockedUseTasks = vi.mocked(useTasks)
const mockedUseUpdateTask = vi.mocked(useUpdateTask)
const mockedUseDeleteTask = vi.mocked(useDeleteTask)

function renderTaskList(onEditTask = vi.fn(), onCreateTask = vi.fn()) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return {
    onEditTask,
    onCreateTask,
    ...render(
      <QueryClientProvider client={queryClient}>
        <TaskList onEditTask={onEditTask} onCreateTask={onCreateTask} />
      </QueryClientProvider>,
    ),
  }
}

const sampleTask: TaskResponse = {
  id: 1,
  title: 'Write report',
  description: 'Quarterly summary',
  priority: 'HIGH',
  status: 'OPEN',
  dueDate: '2026-06-15',
  estimatedMinutes: 60,
  remainingEffortMinutes: 25,
  effortVersion: 0,
  blockedBy: [],
  blocks: [],
}

describe('TaskList', () => {
  beforeEach(() => {
    mockedUseUpdateTask.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useUpdateTask>)
    mockedUseDeleteTask.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useDeleteTask>)
  })

  it('renders skeleton rows while loading', () => {
    mockedUseTasks.mockReturnValue({
      isPending: true,
      isError: false,
      isEmpty: false,
      tasks: [],
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useTasks>)

    renderTaskList()

    expect(screen.getByRole('status', { name: /loading tasks/i })).toBeInTheDocument()
    expect(screen.getAllByTestId('task-skeleton-row')).toHaveLength(3)
  })

  it('renders an empty state when there are no tasks', () => {
    mockedUseTasks.mockReturnValue({
      isPending: false,
      isSuccess: true,
      isError: false,
      isEmpty: true,
      tasks: [],
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useTasks>)

    renderTaskList()

    expect(screen.getByText(/no tasks yet/i)).toBeInTheDocument()
    expect(
      screen.getByText(/click new task to create your first one/i),
    ).toBeInTheDocument()
  })

  it('renders empty-state New Task button that calls onCreateTask', () => {
    const onCreateTask = vi.fn()
    mockedUseTasks.mockReturnValue({
      isPending: false,
      isSuccess: true,
      isError: false,
      isEmpty: true,
      tasks: [],
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useTasks>)

    renderTaskList(vi.fn(), onCreateTask)

    const createButton = screen.getByRole('button', { name: /^new task$/i })
    expect(createButton).toBeInTheDocument()
    fireEvent.click(createButton)
    expect(onCreateTask).toHaveBeenCalled()
  })

  it('renders an error alert with retry action', () => {
    const refetch = vi.fn()
    mockedUseTasks.mockReturnValue({
      isPending: false,
      isError: true,
      isEmpty: false,
      tasks: [],
      error: new ApiError({ status: 500, message: 'Failed to load tasks' }),
      refetch,
    } as unknown as ReturnType<typeof useTasks>)

    renderTaskList()

    expect(screen.getByRole('alert')).toHaveTextContent('Failed to load tasks')
    fireEvent.click(screen.getByRole('button', { name: /retry/i }))
    expect(refetch).toHaveBeenCalled()
  })

  it('renders loaded task rows with key fields', () => {
    mockedUseTasks.mockReturnValue({
      isPending: false,
      isSuccess: true,
      isError: false,
      isEmpty: false,
      tasks: [sampleTask],
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useTasks>)

    renderTaskList()

    expect(screen.getByText('Write report')).toBeInTheDocument()
    expect(screen.getByText('High')).toBeInTheDocument()
    const statusBadge = document.querySelector('[data-status="OPEN"]')
    expect(statusBadge).toBeInTheDocument()
    expect(statusBadge).toHaveTextContent('Open')
    const priorityBadge = document.querySelector('[data-priority="HIGH"]')
    expect(priorityBadge).toBeInTheDocument()
    expect(priorityBadge).toHaveTextContent('High')
    expect(screen.queryByText('HIGH')).not.toBeInTheDocument()
    expect(screen.queryByText('OPEN')).not.toBeInTheDocument()
    expect(screen.getByText('2026-06-15')).toBeInTheDocument()
    expect(screen.getByText('60 min')).toBeInTheDocument()
    expect(document.querySelector('[data-meta="priority"]')).toBeInTheDocument()
    expect(document.querySelector('[data-meta="status"]')).toBeInTheDocument()
    expect(document.querySelector('[data-meta="dueDate"]')).toBeInTheDocument()
    expect(document.querySelector('[data-meta="estimatedMinutes"]')).toBeInTheDocument()
  })

  it('shows remaining effort separately from the whole-task estimate', () => {
    mockedUseTasks.mockReturnValue({
      isPending: false,
      isSuccess: true,
      isError: false,
      isEmpty: false,
      tasks: [sampleTask],
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useTasks>)

    renderTaskList()

    expect(screen.getByText('60 min')).toBeInTheDocument()
    expect(screen.getByText('25 min remaining')).toBeInTheDocument()
    expect(document.querySelector('[data-meta="remainingEffortMinutes"]')).toBeInTheDocument()
  })

  it('shows unknown remaining effort as Unknown, not zero', () => {
    mockedUseTasks.mockReturnValue({
      isPending: false,
      isSuccess: true,
      isError: false,
      isEmpty: false,
      tasks: [{ ...sampleTask, remainingEffortMinutes: null }],
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useTasks>)

    renderTaskList()

    expect(screen.getByText('Unknown remaining')).toBeInTheDocument()
    expect(screen.queryByText('0 min remaining')).not.toBeInTheDocument()
  })

  it('sends effortVersion without remainingEffortMinutes when status changes to In progress', () => {
    const updateMutate = vi.fn()
    mockedUseUpdateTask.mockReturnValue({
      mutate: updateMutate,
      isPending: false,
    } as unknown as ReturnType<typeof useUpdateTask>)
    mockedUseTasks.mockReturnValue({
      isPending: false,
      isSuccess: true,
      isError: false,
      isEmpty: false,
      tasks: [sampleTask],
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useTasks>)

    renderTaskList()

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
        effortVersion: 0,
      },
    })
    expect(updateMutate.mock.calls[0]?.[0].request).not.toHaveProperty(
      'remainingEffortMinutes',
    )
  })

  it('sends finish update with currentDate when status changes to Done', async () => {
    const updateMutate = vi.fn()
    mockedUseUpdateTask.mockReturnValue({
      mutate: updateMutate,
      isPending: false,
    } as unknown as ReturnType<typeof useUpdateTask>)
    mockedUseTasks.mockReturnValue({
      isPending: false,
      isSuccess: true,
      isError: false,
      isEmpty: false,
      tasks: [sampleTask],
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useTasks>)

    renderTaskList()

    fireEvent.change(screen.getByLabelText(/change status for write report/i), {
      target: { value: 'DONE' },
    })
    fireEvent.click(await screen.findByRole('button', { name: /^finish task$/i }))

    expect(updateMutate).toHaveBeenCalledWith({
      id: 1,
      request: expect.objectContaining({
        status: 'DONE',
        currentDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        effortVersion: 0,
      }),
    })
    expect(updateMutate.mock.calls[0]?.[0].request).not.toHaveProperty(
      'remainingEffortMinutes',
    )
  })

  it('sends effortVersion without remainingEffortMinutes when status changes to Cancelled', () => {
    const updateMutate = vi.fn()
    mockedUseUpdateTask.mockReturnValue({
      mutate: updateMutate,
      isPending: false,
    } as unknown as ReturnType<typeof useUpdateTask>)
    mockedUseTasks.mockReturnValue({
      isPending: false,
      isSuccess: true,
      isError: false,
      isEmpty: false,
      tasks: [sampleTask],
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useTasks>)

    renderTaskList()

    fireEvent.change(screen.getByLabelText(/change status for write report/i), {
      target: { value: 'CANCELLED' },
    })

    expect(updateMutate).toHaveBeenCalledWith({
      id: 1,
      request: expect.objectContaining({
        status: 'CANCELLED',
        effortVersion: 0,
      }),
    })
    expect(updateMutate.mock.calls[0]?.[0].request).not.toHaveProperty(
      'remainingEffortMinutes',
    )
  })

  it('calls onEditTask when edit action is clicked', async () => {
    const onEditTask = vi.fn()
    mockedUseTasks.mockReturnValue({
      isPending: false,
      isSuccess: true,
      isError: false,
      isEmpty: false,
      tasks: [sampleTask],
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useTasks>)

    renderTaskList(onEditTask)

    fireEvent.click(screen.getByRole('button', { name: /task actions for write report/i }))
    fireEvent.click(await screen.findByRole('menuitem', { name: /edit/i }))

    expect(onEditTask).toHaveBeenCalledWith(sampleTask)
  })

  it('shows active dependency counts only when both tasks are Open or In progress', () => {
    mockedUseTasks.mockReturnValue({
      isPending: false,
      isSuccess: true,
      isError: false,
      isEmpty: false,
      tasks: [
        {
          ...sampleTask,
          blockedBy: [{ taskId: 2, title: 'Blocker', status: 'OPEN' }],
          blocks: [{ taskId: 3, title: 'Dependent', status: 'IN_PROGRESS' }],
        },
        {
          id: 2,
          title: 'Done blocker endpoint',
          description: null,
          priority: 'MEDIUM',
          status: 'OPEN',
          dueDate: null,
          estimatedMinutes: 20,
          remainingEffortMinutes: 20,
          effortVersion: 0,
          blockedBy: [],
          blocks: [{ taskId: 1, title: 'Write report', status: 'OPEN' }],
        },
        {
          id: 4,
          title: 'Done blocked task',
          description: null,
          priority: 'LOW',
          status: 'DONE',
          dueDate: null,
          estimatedMinutes: 10,
          remainingEffortMinutes: 0,
          effortVersion: 0,
          blockedBy: [{ taskId: 1, title: 'Write report', status: 'OPEN' }],
          blocks: [],
        },
      ],
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useTasks>)

    renderTaskList()

    const writeReportRow = screen
      .getByRole('heading', { name: /write report/i })
      .closest('[data-slot="card"]') as HTMLElement
    expect(within(writeReportRow).getByText('Blocked by 1')).toBeInTheDocument()
    expect(within(writeReportRow).getByText('Blocks 1')).toBeInTheDocument()

    const doneRow = screen
      .getByRole('heading', { name: /done blocked task/i })
      .closest('[data-slot="card"]') as HTMLElement
    expect(within(doneRow).queryByText(/blocked by/i)).not.toBeInTheDocument()
  })

  it('calls delete mutation only after confirmation', async () => {
    const deleteMutate = vi.fn()
    mockedUseDeleteTask.mockReturnValue({
      mutate: deleteMutate,
      isPending: false,
    } as unknown as ReturnType<typeof useDeleteTask>)
    mockedUseTasks.mockReturnValue({
      isPending: false,
      isSuccess: true,
      isError: false,
      isEmpty: false,
      tasks: [sampleTask],
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useTasks>)

    renderTaskList()

    fireEvent.click(screen.getByRole('button', { name: /task actions for write report/i }))
    fireEvent.click(await screen.findByRole('menuitem', { name: /delete/i }))

    expect(deleteMutate).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /^delete task$/i }))
    expect(deleteMutate).toHaveBeenCalledWith(1)
  })
})

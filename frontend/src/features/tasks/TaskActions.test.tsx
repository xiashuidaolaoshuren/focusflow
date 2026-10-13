import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'

import type { TaskResponse } from '@/types/api'
import { TaskActions } from '@/features/tasks/TaskActions'
import { PROGRESS_CONFLICT_MESSAGE } from '@/features/tasks/taskEffortConflict'
import type { UseUpdateTaskOptions } from '@/features/tasks/hooks'

vi.mock('@/features/tasks/hooks', () => ({
  useUpdateTask: vi.fn(),
}))

vi.mock('@/lib/planningDate', () => ({
  getLocalDateString: vi.fn(() => '2026-06-15'),
}))

import { useUpdateTask } from '@/features/tasks/hooks'

const mockedUseUpdateTask = vi.mocked(useUpdateTask)

const sampleTask: TaskResponse = {
  id: 1,
  title: 'Write report',
  description: 'Quarterly summary',
  priority: 'HIGH',
  status: 'IN_PROGRESS',
  dueDate: '2026-06-15',
  estimatedMinutes: 60,
  remainingEffortMinutes: 25,
  effortVersion: 2,
  blockedBy: [],
  blocks: [],
}

function renderTaskActions(
  task: TaskResponse = sampleTask,
  overrides: Partial<{
    onEdit: (task: TaskResponse) => void
    onDelete: (task: TaskResponse) => void
    isDeleting: boolean
  }> = {},
) {
  const onEdit = overrides.onEdit ?? vi.fn()
  const onDelete = overrides.onDelete ?? vi.fn()
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  render(
    <QueryClientProvider client={queryClient}>
      <TaskActions
        task={task}
        onEdit={onEdit}
        onDelete={onDelete}
        isDeleting={overrides.isDeleting ?? false}
      />
    </QueryClientProvider>,
  )

  return { onEdit, onDelete }
}

describe('TaskActions', () => {
  beforeEach(() => {
    mockedUseUpdateTask.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useUpdateTask>)
  })

  it('calls onEdit when edit action is clicked', async () => {
    const onEdit = vi.fn()
    renderTaskActions(sampleTask, { onEdit })

    fireEvent.click(screen.getByRole('button', { name: /task actions for write report/i }))
    fireEvent.click(await screen.findByRole('menuitem', { name: /edit/i }))

    expect(onEdit).toHaveBeenCalledWith(sampleTask)
  })

  it('does not call onDelete until delete is confirmed', async () => {
    const onDelete = vi.fn()
    renderTaskActions(sampleTask, { onDelete })

    fireEvent.click(screen.getByRole('button', { name: /task actions for write report/i }))
    fireEvent.click(await screen.findByRole('menuitem', { name: /delete/i }))

    expect(onDelete).not.toHaveBeenCalled()
    expect(
      screen.getByRole('alertdialog', { name: /delete task/i }),
    ).toBeInTheDocument()
  })

  it('calls onDelete when delete confirmation is accepted', async () => {
    const onDelete = vi.fn()
    renderTaskActions(sampleTask, { onDelete })

    fireEvent.click(screen.getByRole('button', { name: /task actions for write report/i }))
    fireEvent.click(await screen.findByRole('menuitem', { name: /delete/i }))
    fireEvent.click(screen.getByRole('button', { name: /^delete task$/i }))

    expect(onDelete).toHaveBeenCalledWith(sampleTask)
  })

  it('disables actions while update or delete is in flight', () => {
    mockedUseUpdateTask.mockReturnValue({
      mutate: vi.fn(),
      isPending: true,
    } as unknown as ReturnType<typeof useUpdateTask>)

    renderTaskActions(sampleTask, { isDeleting: true })

    expect(
      screen.getByLabelText(/change status for write report/i),
    ).toBeDisabled()
    expect(
      screen.getByRole('button', { name: /task actions for write report/i }),
    ).toBeDisabled()
  })

  it('sends finish update with currentDate and effortVersion when Done is confirmed', async () => {
    const mutate = vi.fn()
    mockedUseUpdateTask.mockReturnValue({
      mutate,
      isPending: false,
    } as unknown as ReturnType<typeof useUpdateTask>)

    renderTaskActions()

    fireEvent.change(screen.getByLabelText(/change status for write report/i), {
      target: { value: 'DONE' },
    })

    expect(
      screen.getByRole('alertdialog', { name: /finish task/i }),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^finish task$/i }))

    expect(mutate).toHaveBeenCalledWith({
      id: 1,
      request: {
        title: 'Write report',
        description: 'Quarterly summary',
        priority: 'HIGH',
        status: 'DONE',
        dueDate: '2026-06-15',
        estimatedMinutes: 60,
        effortVersion: 2,
        currentDate: '2026-06-15',
      },
    })
    expect(mutate.mock.calls[0]?.[0].request).not.toHaveProperty(
      'remainingEffortMinutes',
    )
  })

  it('sends effortVersion without remainingEffortMinutes when status changes to Cancelled', () => {
    const mutate = vi.fn()
    mockedUseUpdateTask.mockReturnValue({
      mutate,
      isPending: false,
    } as unknown as ReturnType<typeof useUpdateTask>)

    renderTaskActions({ ...sampleTask, status: 'OPEN' })

    fireEvent.change(screen.getByLabelText(/change status for write report/i), {
      target: { value: 'CANCELLED' },
    })

    expect(mutate).toHaveBeenCalledWith({
      id: 1,
      request: expect.objectContaining({
        status: 'CANCELLED',
        effortVersion: 2,
      }),
    })
    expect(mutate.mock.calls[0]?.[0].request).not.toHaveProperty(
      'remainingEffortMinutes',
    )
  })

  it('blocks reopen submit until a positive remainder or explicit unknown is chosen', async () => {
    const mutate = vi.fn()
    mockedUseUpdateTask.mockReturnValue({
      mutate,
      isPending: false,
    } as unknown as ReturnType<typeof useUpdateTask>)

    renderTaskActions({ ...sampleTask, status: 'DONE', remainingEffortMinutes: 0 })

    fireEvent.change(screen.getByLabelText(/change status for write report/i), {
      target: { value: 'OPEN' },
    })

    expect(
      screen.getByRole('alertdialog', { name: /reopen task/i }),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /^reopen task$/i }))
    expect(mutate).not.toHaveBeenCalled()

    fireEvent.change(screen.getByLabelText(/remaining effort minutes/i), {
      target: { value: '30' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^reopen task$/i }))

    expect(mutate).toHaveBeenCalledWith({
      id: 1,
      request: expect.objectContaining({
        status: 'OPEN',
        remainingEffortMinutes: 30,
        currentDate: '2026-06-15',
        effortVersion: 2,
      }),
    })
  })

  it('closes reopen dialog and explains PROGRESS_CONFLICT', async () => {
    let hookOptions: UseUpdateTaskOptions | undefined
    mockedUseUpdateTask.mockImplementation((options) => {
      hookOptions = options
      return {
        mutate: vi.fn(),
        isPending: false,
      } as unknown as ReturnType<typeof useUpdateTask>
    })

    renderTaskActions({ ...sampleTask, status: 'DONE', remainingEffortMinutes: 0 })

    fireEvent.change(screen.getByLabelText(/change status for write report/i), {
      target: { value: 'OPEN' },
    })
    expect(
      screen.getByRole('alertdialog', { name: /reopen task/i }),
    ).toBeInTheDocument()

    await act(async () => {
      hookOptions?.onEffortConflict?.()
    })

    await waitFor(() => {
      expect(
        screen.queryByRole('alertdialog', { name: /reopen task/i }),
      ).not.toBeInTheDocument()
    })
    expect(screen.getByText(PROGRESS_CONFLICT_MESSAGE)).toBeInTheDocument()
  })

  it('disables the Open option once work is recorded', () => {
    renderTaskActions({ ...sampleTask, status: 'IN_PROGRESS', effortVersion: 2 })

    expect(screen.getByRole('option', { name: /^open$/i })).toBeDisabled()
  })

  it('keeps the Open option available for an in-progress task without recorded work', () => {
    renderTaskActions({ ...sampleTask, status: 'IN_PROGRESS', effortVersion: 0 })

    expect(screen.getByRole('option', { name: /^open$/i })).not.toBeDisabled()
  })

  it('allows reopen with explicit unknown remaining effort', async () => {
    const mutate = vi.fn()
    mockedUseUpdateTask.mockReturnValue({
      mutate,
      isPending: false,
    } as unknown as ReturnType<typeof useUpdateTask>)

    renderTaskActions({ ...sampleTask, status: 'CANCELLED' })

    fireEvent.change(screen.getByLabelText(/change status for write report/i), {
      target: { value: 'IN_PROGRESS' },
    })

    fireEvent.click(screen.getByLabelText(/remaining effort is unknown/i))
    fireEvent.click(screen.getByRole('button', { name: /^reopen task$/i }))

    expect(mutate).toHaveBeenCalledWith({
      id: 1,
      request: expect.objectContaining({
        status: 'IN_PROGRESS',
        remainingEffortMinutes: null,
        currentDate: '2026-06-15',
        effortVersion: 2,
      }),
    })
  })
})
